import { executeTask, executeTasks } from "@core/core/routing/engine/index.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"

const repo = { owner: "acme", name: "widget" }
const stackInput = { ...repo, stackNumber: 42 }
const lower = {
  number: 8,
  state: "closed",
  merged_at: null,
  draft: false,
  head: { ref: "schema", sha: "a".repeat(40) },
  base: { ref: "main" },
  node_id: "PR_schema",
}
const upper = {
  number: 9,
  state: "open",
  merged_at: null,
  draft: false,
  head: { ref: "api", sha: "b".repeat(40) },
  base: { ref: "schema" },
  node_id: "PR_api",
}
const stack = { number: 42, base: { ref: "main" }, open: true, pull_requests: [lower, upper] }
const invalidResponse = {
  ok: false,
  error: {
    code: "SERVER",
    message: "GitHub returned an invalid stack response",
    retryable: false,
  },
  meta: { route_used: "rest" },
}

function mockStackDeps(restFetch: typeof fetch) {
  const execute = vi.fn(async (): Promise<never> => {
    throw new Error("GraphQL unavailable")
  })
  return {
    githubClient: createGithubClient({ execute }),
    githubHost: "github.com",
    githubToken: "test-token",
    restFetch,
    execute,
  }
}

describe("native stack pagination", () => {
  it("sends the PR filter and binds the returned cursor to that filter and page size", async () => {
    const restFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json([{ ...stack, pull_requests: [{ number: 8 }, { number: 9 }] }], {
          headers: { link: '<https://api.github.com/repositories/1/stacks?page=2>; rel="next"' },
        }),
      )
      .mockResolvedValueOnce(Response.json([]))
    const deps = mockStackDeps(restFetch)
    const input = { ...repo, prNumber: 9, first: 1 }
    const first = await executeTask({ task: "pr.stack.list", input }, deps)

    expect(first).toMatchObject({
      ok: true,
      data: {
        items: [{ stackNumber: 42, prNumbers: [8, 9] }],
        pageInfo: { hasNextPage: true, endCursor: expect.any(String) },
      },
    })
    const { endCursor: after } = (first.data as { pageInfo: { endCursor: string } }).pageInfo
    for (const changes of [{ prNumber: 8 }, { first: 2 }, { after: "invalid-cursor" }]) {
      const result = await executeTask(
        { task: "pr.stack.list", input: { ...input, after, ...changes } },
        deps,
      )
      expect(result.error).toMatchObject({ code: "VALIDATION", retryable: false })
    }
    expect(restFetch).toHaveBeenCalledTimes(1)

    const second = await executeTask({ task: "pr.stack.list", input: { ...input, after } }, deps)
    expect(second.data).toEqual({ items: [], pageInfo: { hasNextPage: false, endCursor: null } })
    expect(restFetch.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.github.com/repos/acme/widget/stacks?per_page=1&page=1&pull_request=9",
      "https://api.github.com/repos/acme/widget/stacks?per_page=1&page=2&pull_request=9",
    ])
  })

  it.each([
    ["another origin", "https://other.example/stacks?page=2"],
    ["an unexpected page", "https://api.github.com/repos/acme/widget/stacks?page=3"],
    ["a relative URL", "/repos/acme/widget/stacks?page=2"],
  ])("rejects a next link with %s", async (_name, url) => {
    const restFetch = vi.fn<typeof fetch>(async () =>
      Response.json([], { headers: { link: `<${url}>; rel="next"` } }),
    )
    const result = await executeTask(
      { task: "pr.stack.list", input: repo },
      mockStackDeps(restFetch),
    )

    expect(result).toMatchObject(invalidResponse)
    expect(restFetch).toHaveBeenCalledTimes(1)
  })

  it("rejects an unexpectedly paginated detail snapshot", async () => {
    const restFetch = vi.fn<typeof fetch>(async () =>
      Response.json(stack, {
        headers: {
          link: '<https://api.github.com/repos/acme/widget/stacks/42?page=2>; rel="next"',
        },
      }),
    )
    const result = await executeTask(
      { task: "pr.stack.view", input: stackInput },
      mockStackDeps(restFetch),
    )
    expect(result).toMatchObject(invalidResponse)
    expect(restFetch).toHaveBeenCalledTimes(1)
  })
})

describe("native stack response validation", () => {
  it("rejects an object on the list endpoint", async () => {
    const restFetch = vi.fn<typeof fetch>(async () => Response.json({ stacks: [] }))
    const result = await executeTask(
      { task: "pr.stack.list", input: repo },
      mockStackDeps(restFetch),
    )

    expect(result).toMatchObject(invalidResponse)
  })

  it.each([
    ["a null stack", null],
    ["a missing membership list", { ...stack, pull_requests: null }],
    ["a different stack number", { ...stack, number: 43 }],
    ["an invalid open flag", { ...stack, open: "true" }],
    ["a duplicate PR number", { ...stack, pull_requests: [lower, lower] }],
    ["an invalid PR number", { ...stack, pull_requests: [{ ...upper, number: "9" }] }],
    ["a fractional PR number", { ...stack, pull_requests: [{ ...upper, number: 1.5 }] }],
    ["a zero PR number", { ...stack, pull_requests: [{ ...upper, number: 0 }] }],
    ["a missing branch name", { ...stack, base: { ref: null } }],
    ["an empty branch name", { ...stack, base: { ref: "" } }],
    [
      "an abbreviated head SHA",
      { ...stack, pull_requests: [{ ...upper, head: { ...upper.head, sha: "abcdef" } }] },
    ],
    ["an unknown PR state", { ...stack, pull_requests: [{ ...upper, state: "unknown" }] }],
    [
      "a merge timestamp on an open PR",
      { ...stack, pull_requests: [{ ...upper, merged_at: "2026-11-19T08:00:00Z" }] },
    ],
    [
      "an invalid merge timestamp on a closed PR",
      { ...stack, pull_requests: [{ ...lower, merged_at: "" }] },
    ],
  ])("rejects a detail response containing %s", async (_name, payload) => {
    const restFetch = vi.fn<typeof fetch>(async () => Response.json(payload))
    const result = await executeTask(
      { task: "pr.stack.view", input: stackInput },
      mockStackDeps(restFetch),
    )

    expect(result).toMatchObject(invalidResponse)
  })
})

describe("native stack status and batch preflight", () => {
  it.each([8, 99])(
    "rejects throughPrNumber %i before fetching signals",
    async (throughPrNumber) => {
      const restFetch = vi.fn<typeof fetch>(async () => Response.json(stack))
      const deps = mockStackDeps(restFetch)
      const result = await executeTask(
        { task: "pr.stack.status", input: { ...stackInput, throughPrNumber } },
        deps,
      )

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: "VALIDATION",
          message: "throughPrNumber must select an open PR in this stack",
        },
      })
      expect(deps.execute).not.toHaveBeenCalled()
      expect(restFetch).toHaveBeenCalledTimes(1)
    },
  )

  it.each([undefined, 9])(
    "returns closed and open topology without a preview when selecting %s",
    async (throughPrNumber) => {
      const restFetch = vi.fn<typeof fetch>(async () => Response.json(stack))
      const deps = mockStackDeps(restFetch)
      const input = throughPrNumber === undefined ? stackInput : { ...stackInput, throughPrNumber }
      const result = await executeTask({ task: "pr.stack.status", input }, deps)

      expect(result).toMatchObject({
        ok: true,
        data: {
          snapshotStatus: "current",
          members: [
            { prNumber: 8, state: "CLOSED", signalsAvailable: false },
            {
              prNumber: 9,
              state: "OPEN",
              reviewDecision: null,
              mergeStateStatus: null,
              checksState: null,
              signalsAvailable: false,
            },
          ],
          mergePreview: null,
        },
      })
      expect(deps.execute).toHaveBeenCalledWith(expect.stringContaining("query PrStackSignals"), {
        ids: ["PR_api"],
      })
      expect(restFetch).toHaveBeenCalledTimes(2)
    },
  )

  it("reports REST and leaves inputs untouched when a chain step fails validation", async () => {
    const restFetch = vi.fn<typeof fetch>()
    const listInput = { ...repo }
    const result = await executeTasks(
      [
        { task: "pr.stack.list", input: listInput },
        { task: "pr.stack.view", input: { ...stackInput, stackNumber: 0 } },
      ],
      mockStackDeps(restFetch),
    )

    expect(result).toMatchObject({
      status: "failed",
      meta: { route_used: "rest", total: 2, failed: 2 },
      results: [
        { ok: false, error: { message: "pre-flight failed" } },
        { ok: false, error: { message: expect.stringContaining("Input validation failed") } },
      ],
    })
    expect(listInput).toEqual(repo)
    expect(restFetch).not.toHaveBeenCalled()
  })
})

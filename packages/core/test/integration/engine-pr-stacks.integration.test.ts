import { executeTask, executeTasks } from "@core/core/routing/engine/index.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"

const repo = { owner: "acme", name: "widget" }
const stack = {
  number: 42,
  base: { ref: "main" },
  open: true,
  pull_requests: [
    {
      number: 12,
      state: "closed",
      merged_at: "2026-11-19T08:00:00Z",
      draft: false,
      head: { ref: "schema", sha: "a".repeat(40) },
      base: { ref: "main" },
      node_id: "PR_schema",
    },
    {
      number: 9,
      state: "open",
      merged_at: null,
      draft: false,
      head: { ref: "api", sha: "b".repeat(40) },
      base: { ref: "main" },
      node_id: "PR_api",
    },
    {
      number: 10,
      state: "open",
      merged_at: null,
      draft: true,
      head: { ref: "ui", sha: "c".repeat(40) },
      base: { ref: "api" },
      node_id: "PR_ui",
    },
  ],
}

const client = createGithubClient({
  async execute<TData>(): Promise<TData> {
    throw new Error("Unexpected GraphQL request")
  },
})

describe("native PR stack capabilities", () => {
  it("follows pagination without following the Link URL and preserves branch order", async () => {
    const restFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json([stack], {
          headers: {
            link: '<https://api.github.com/repositories/999/stacks?per_page=1&page=2>; rel="next"',
          },
        }),
      )
      .mockResolvedValueOnce(Response.json([]))

    const deps = { githubClient: client, githubToken: "test-token", restFetch }
    const input = { ...repo, first: 1 }
    const first = await executeTask({ task: "pr.stack.list", input }, deps)
    expect(first).toMatchObject({
      ok: true,
      data: {
        items: [{ stackNumber: 42, baseRefName: "main", open: true, prNumbers: [12, 9, 10] }],
        pageInfo: { hasNextPage: true, endCursor: expect.any(String) },
      },
      meta: { route_used: "rest" },
    })

    const data = first.data as { pageInfo: { endCursor: string } }
    const otherRepo = await executeTask(
      { task: "pr.stack.list", input: { ...input, name: "other", after: data.pageInfo.endCursor } },
      deps,
    )
    expect(otherRepo.error?.code).toBe("VALIDATION")
    expect(restFetch).toHaveBeenCalledTimes(1)

    const second = await executeTask(
      { task: "pr.stack.list", input: { ...input, after: data.pageInfo.endCursor } },
      deps,
    )
    expect(second.data).toEqual({ items: [], pageInfo: { hasNextPage: false, endCursor: null } })
    expect(String(restFetch.mock.calls[1]?.[0])).toBe(
      "https://api.github.com/repos/acme/widget/stacks?per_page=1&page=2",
    )
  })

  it("runs two REST reads through chain and preserves independent failures", async () => {
    const restFetch = vi.fn<typeof fetch>(async (url) =>
      String(url).endsWith("/42") ? Response.json(stack) : new Response(null, { status: 404 }),
    )
    const result = await executeTasks(
      [42, 43].map((stackNumber) => ({
        task: "pr.stack.view",
        input: { ...repo, stackNumber },
      })),
      { githubClient: client, githubToken: "test-token", restFetch },
    )
    expect(result).toMatchObject({
      status: "partial",
      meta: { route_used: "rest" },
      results: [
        {
          ok: true,
          data: {
            members: [
              { prNumber: 12, position: 1, state: "MERGED" },
              { prNumber: 9, position: 2, state: "OPEN", baseRefName: "main" },
              { prNumber: 10, position: 3, state: "OPEN", isDraft: true },
            ],
          },
        },
        { ok: false, error: { code: "NOT_FOUND" } },
      ],
    })
  })
  it("previews an open prefix and associates signals with the corresponding head", async () => {
    const restFetch = vi.fn<typeof fetch>(async () => Response.json(stack))
    const execute = vi.fn(async () => ({
      nodes: [
        {
          __typename: "PullRequest",
          id: "PR_api",
          headRefOid: "b".repeat(40),
          reviewDecision: "APPROVED",
          mergeStateStatus: "BLOCKED",
          statusCheckRollup: { state: "PENDING" },
        },
        null,
      ],
    }))
    const result = await executeTask(
      { task: "pr.stack.status", input: { ...repo, stackNumber: 42, throughPrNumber: 9 } },
      {
        githubClient: createGithubClient({ execute } as Parameters<typeof createGithubClient>[0]),
        githubToken: "test-token",
        restFetch,
      },
    )

    expect(restFetch).toHaveBeenCalledTimes(2)
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("query PrStackSignals"), {
      ids: ["PR_api", "PR_ui"],
    })
    expect(result).toMatchObject({
      ok: true,
      data: {
        snapshotStatus: "current",
        members: [
          { state: "MERGED", signalsAvailable: false },
          {
            prNumber: 9,
            signalsAvailable: true,
            reviewDecision: "APPROVED",
            checksState: "PENDING",
          },
          { prNumber: 10, isDraft: true, signalsAvailable: false },
        ],
        mergePreview: {
          stackNumber: 42,
          throughPrNumber: 9,
          expectedBaseRefName: "main",
          expectedMembers: [{ prNumber: 9, headSha: "b".repeat(40) }],
        },
      },
    })
  })

  it("suppresses the preview when a layer changes during status collection", async () => {
    const changed = structuredClone(stack)
    const lower = changed.pull_requests[1]
    if (lower === undefined) throw new Error("Missing fixture layer")
    lower.head.sha = "d".repeat(40)
    const restFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(stack))
      .mockResolvedValueOnce(Response.json(changed))

    const result = await executeTask(
      { task: "pr.stack.status", input: { ...repo, stackNumber: 42, throughPrNumber: 10 } },
      { githubClient: client, githubToken: "test-token", restFetch },
    )
    expect(result).toMatchObject({
      ok: true,
      data: { snapshotStatus: "stale", mergePreview: null },
    })
  })

  it("does not turn a throttled REST read into an immediate retry or an auth refresh", async () => {
    const restFetch = vi.fn<typeof fetch>(
      async () =>
        new Response("Private response body", { status: 403, headers: { "retry-after": "90" } }),
    )
    const result = await executeTask(
      { task: "pr.stack.list", input: repo },
      { githubClient: client, githubToken: "test-token", restFetch },
    )
    expect(restFetch).toHaveBeenCalledTimes(1)
    expect(result.error).toMatchObject({
      code: "RATE_LIMIT",
      retryable: true,
      details: { status: 403, retryAfterSeconds: 90 },
    })
    expect(JSON.stringify(result)).not.toContain("Private response body")
  })

  it("rejects other GitHub hosts before sending credentials", async () => {
    const restFetch = vi.fn<typeof fetch>()
    const result = await executeTask(
      { task: "pr.stack.list", input: repo },
      { githubClient: client, githubToken: "test-token", githubHost: "git.example.com", restFetch },
    )
    expect(result.error?.code).toBe("ADAPTER_UNSUPPORTED")
    expect(restFetch).not.toHaveBeenCalled()
  })
  it("reports invalid JSON and network failures without leaking transport details", async () => {
    const restFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("private content"))
      .mockRejectedValueOnce(new Error("private network details"))
    const request = { task: "pr.stack.list", input: repo }
    const deps = { githubClient: client, githubToken: "test-token", restFetch }
    const invalid = await executeTask(request, deps)
    const unavailable = await executeTask(request, deps)

    expect(invalid.error).toMatchObject({ code: "SERVER", retryable: false })
    expect(unavailable.error).toMatchObject({ code: "NETWORK", retryable: true })
    expect(JSON.stringify([invalid, unavailable])).not.toContain("private")
    expect(request.input).toEqual({ owner: "acme", name: "widget" })
  })

  it("rejects an incomplete stack snapshot instead of returning it as empty membership", async () => {
    const restFetch = vi.fn<typeof fetch>(async () =>
      Response.json({ ...stack, pull_requests: [] }),
    )
    const result = await executeTask(
      { task: "pr.stack.view", input: { ...repo, stackNumber: 42 } },
      { githubClient: client, githubToken: "test-token", restFetch },
    )

    expect(result).toMatchObject({
      ok: false,
      error: { code: "SERVER", message: "GitHub returned an invalid stack response" },
    })
  })
})

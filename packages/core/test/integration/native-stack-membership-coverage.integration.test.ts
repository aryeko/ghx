import { executeTask, executeTasks } from "@core/core/routing/engine/index.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"

const repo = { owner: "Acme", name: "Widget" }
const repoPath = "/repos/Acme/Widget"
const repoIdentity = { id: 123, full_name: "ACME/widget" }
const githubClient = createGithubClient({
  async execute<T>(): Promise<T> {
    throw new Error("Unexpected GraphQL request")
  },
})

function pull(number: number, base: string, head: string, identity = repoIdentity) {
  return {
    number,
    state: "open",
    merged_at: null,
    draft: false,
    node_id: `PR_${number}`,
    base: { ref: base, repo: identity },
    head: { ref: head, repo: identity, sha: "a".repeat(40) },
  }
}

const lower = pull(30, "main", "schema")
const upper = pull(12, "schema", "api")
const candidate = pull(25, "api", "ui")
const stack = { number: 42, base: { ref: "main" }, open: true, pull_requests: [lower, upper] }
const add = {
  task: "pr.stack.add",
  input: { ...repo, stackNumber: 42, expectedTopPrNumber: 12, prNumbers: [25] },
}
const unstack = {
  task: "pr.stack.unstack",
  input: { ...repo, stackNumber: 42, expectedPrNumbers: [30, 12] },
}
const create = { task: "pr.stack.create", input: { ...repo, prNumbers: [30, 12] } }
const nextPage = { link: `<https://api.github.com${repoPath}/stacks?page=2>; rel="next"` }

function setup({
  pulls = new Map<number, unknown>([
    [30, lower],
    [12, upper],
    [25, candidate],
  ]),
  currentStack = stack,
  membership = () => Response.json([]),
  submit = () => Response.json({ ...stack, pull_requests: [lower, upper, candidate] }),
}: {
  pulls?: ReadonlyMap<number, unknown>
  currentStack?: typeof stack
  membership?: (prNumber: number) => Response
  submit?: () => Response
} = {}) {
  const write = vi.fn((_url: URL, _options: RequestInit) => submit())
  const restFetch = vi.fn<typeof fetch>(async (url, options) => {
    const requestUrl = new URL(String(url))
    if (options?.method === "POST") return write(requestUrl, options)
    const { pathname, searchParams } = requestUrl
    if (pathname === `${repoPath}/stacks/42`) return Response.json(currentStack)
    if (pathname === `${repoPath}/stacks`) {
      return membership(Number(searchParams.get("pull_request")))
    }
    const number = Number(pathname.split("/").at(-1))
    if (pathname === `${repoPath}/pulls/${number}` && pulls.has(number)) {
      return Response.json(pulls.get(number))
    }
    throw new Error(`Unexpected REST request ${pathname}`)
  })
  return {
    deps: { githubClient, githubToken: "test-token", githubHost: "github.com", restFetch },
    write,
  }
}

describe("native stack membership dispatch", () => {
  it("normalizes append results from the single-task dispatcher", async () => {
    const { deps, write } = setup()

    const result = await executeTask(add, deps)

    expect(result).toMatchObject({
      ok: true,
      data: { stackNumber: 42, members: [{ prNumber: 30 }, { prNumber: 12 }, { prNumber: 25 }] },
      meta: { route_used: "rest" },
    })
    expect(write).toHaveBeenCalledExactlyOnceWith(
      new URL(`https://api.github.com${repoPath}/stacks/42/add`),
      expect.objectContaining({
        method: "POST",
        body: '{"pull_requests":[25]}',
        headers: expect.objectContaining({ "content-type": "application/json" }),
      }),
    )
  })

  it("normalizes dissolution after an empty 204 response", async () => {
    const { deps, write } = setup({ submit: () => new Response(null, { status: 204 }) })

    await expect(executeTask(unstack, deps)).resolves.toMatchObject({
      ok: true,
      data: { dissolved: true, remainingPrNumbers: [] },
      meta: { route_used: "rest" },
    })
    expect(write).toHaveBeenCalledExactlyOnceWith(
      new URL(`https://api.github.com${repoPath}/stacks/42/unstack`),
      expect.objectContaining({ method: "POST" }),
    )
    expect(write.mock.calls[0]?.[1]).not.toHaveProperty("body")
  })

  it("rejects a sparse batch containing a membership mutation before network calls", async () => {
    const { deps } = setup()
    const requests: (typeof add)[] = []
    requests[1] = add

    await expect(executeTasks(requests, deps)).resolves.toMatchObject({
      status: "failed",
      results: [
        { task: "unknown", ok: false, error: { code: "VALIDATION" } },
        { task: add.task, ok: false, error: { code: "VALIDATION" } },
      ],
    })
    expect(deps.restFetch).not.toHaveBeenCalled()
  })
})

describe("native stack membership refuses inconsistent preflight data", () => {
  it.each([
    ["null PR data", null],
    ["a mismatched PR number", { ...candidate, number: 26 }],
    ["an unknown PR state", { ...candidate, state: "merged" }],
    ["a missing branch", { ...candidate, base: undefined }],
    ["a non-string ref", { ...candidate, base: { ...candidate.base, ref: 201 } }],
    ["an empty ref", { ...candidate, base: { ...candidate.base, ref: "" } }],
    ["a missing repository record", { ...candidate, head: { ...candidate.head, repo: false } }],
    [
      "an invalid repository ID",
      { ...candidate, head: { ...candidate.head, repo: { ...repoIdentity, id: "123" } } },
    ],
    [
      "an invalid repository name",
      { ...candidate, head: { ...candidate.head, repo: { id: 123 } } },
    ],
    [
      "an empty repository name",
      { ...candidate, head: { ...candidate.head, repo: { id: 123, full_name: "" } } },
    ],
  ])("does not append with %s", async (_name, data) => {
    const { deps, write } = setup({ pulls: new Map([[25, data]]) })

    await expect(executeTask(add, deps)).resolves.toMatchObject({
      ok: false,
      error: { code: "SERVER", retryable: false, details: { prNumber: 25 } },
    })
    expect(write).not.toHaveBeenCalled()
  })

  it("rejects a candidate whose head repository was deleted", async () => {
    const { deps, write } = setup({
      pulls: new Map([[25, { ...candidate, head: { ...candidate.head, repo: null } }]]),
    })

    await expect(executeTask(add, deps)).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION", retryable: false, details: { prNumber: 25 } },
    })
    expect(write).not.toHaveBeenCalled()
  })

  it("rejects a candidate whose fork head has a different repository name", async () => {
    const { deps, write } = setup({
      pulls: new Map([
        [
          25,
          {
            ...candidate,
            head: { ...candidate.head, repo: { ...repoIdentity, full_name: "fork/widget" } },
          },
        ],
      ]),
    })

    await expect(executeTask(add, deps)).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION", retryable: false, details: { prNumber: 25 } },
    })
    expect(write).not.toHaveBeenCalled()
  })

  it.each([
    ["the lookup advertises more matches", () => Response.json([], { headers: nextPage })],
    ["the lookup returns multiple stacks", () => Response.json([stack, { ...stack, number: 43 }])],
    ["the returned stack omits the filtered PR", () => Response.json([stack])],
  ])("does not append when %s", async (_name, membership) => {
    const { deps, write } = setup({ membership })

    await expect(executeTask(add, deps)).resolves.toMatchObject({
      ok: false,
      error: {
        code: "SERVER",
        message: "GitHub returned an invalid stack response",
        retryable: false,
      },
    })
    expect(write).not.toHaveBeenCalled()
  })

  it("rejects candidates whose reported repository IDs differ despite matching names", async () => {
    const inconsistent = pull(12, "schema", "api", { ...repoIdentity, id: 456 })
    const { deps, write } = setup({
      pulls: new Map([
        [30, lower],
        [12, inconsistent],
      ]),
    })

    await expect(executeTask(create, deps)).resolves.toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION",
        message: "The PRs must belong to the same target repository",
        details: { prNumber: 12 },
      },
    })
    expect(write).not.toHaveBeenCalled()
  })

  it.each([
    ["the stack is closed", { ...stack, open: false }, "PRs can only be appended to an open stack"],
    [
      "the stack already contains the candidate",
      { ...stack, pull_requests: [candidate, upper] },
      "A PR to append already belongs to the target stack",
    ],
  ])("rejects an append when %s", async (_name, currentStack, message) => {
    const { deps, write } = setup({ currentStack })

    await expect(executeTask(add, deps)).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION", message, details: { stackNumber: 42 } },
    })
    expect(write).not.toHaveBeenCalled()
  })

  it("rejects unstack when the observed membership has grown", async () => {
    const { deps, write } = setup({
      currentStack: { ...stack, pull_requests: [lower, upper, candidate] },
    })

    await expect(executeTask(unstack, deps)).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION", details: { actualPrNumbers: [30, 12, 25] } },
    })
    expect(write).not.toHaveBeenCalled()
  })
})

describe("native stack membership preserves scope for ambiguous submissions", () => {
  it.each([
    {
      name: "unexpected success status",
      status: 202,
      submit: () => new Response(null, { status: 202 }),
    },
    {
      name: "HTTP request timeout",
      status: 408,
      submit: () => new Response(null, { status: 408 }),
    },
    {
      name: "unreadable success body",
      status: 201,
      submit: () => new Response("invalid JSON", { status: 201 }),
    },
    {
      name: "missing stack identifier",
      status: 201,
      submit: () => Response.json(null, { status: 201 }),
    },
    {
      name: "paginated success body",
      status: 201,
      stackNumber: 42,
      submit: () =>
        Response.json(stack, {
          status: 201,
          headers: { ...nextPage, "x-github-request-id": "invalid value" },
        }),
    },
  ])("does not replay a create after $name", async ({ status, stackNumber, submit }) => {
    const { deps, write } = setup({ submit })

    const result = await executeTask(create, deps)

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "SERVER",
        retryable: false,
        details: { status, submissionOutcome: "unknown", repo: "Acme/Widget", prNumbers: [30, 12] },
      },
    })
    expect(result.error?.details).not.toHaveProperty("githubRequestId")
    expect(result.error?.details?.stackNumber).toBe(stackNumber)
    expect(write).toHaveBeenCalledTimes(1)
  })
})

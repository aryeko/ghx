import { executeTasks } from "@core/core/routing/engine/index.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"

// Regression target: a `ghx chain` step for `pr.threads.list` that omits `first`
// must NOT fail with "Variable $first of type Int! was provided invalid value".
// The fix: AJV useDefaults injects first:30 at the validation boundary (runPreflight)
// so both the `run` path and the `chain` path get the default automatically.
//
// For 2-step chains, executeBatch is used and the batch query goes through
// githubClient.query (not queryRaw). This test exercises that path directly.

const makeThreadsResult = () => ({
  items: [],
  pageInfo: { hasNextPage: false, endCursor: null },
  filterApplied: { unresolvedOnly: true, includeOutdated: false },
  scan: { pagesScanned: 1, sourceItemsScanned: 0, scanTruncated: false },
})

describe("executeTasks chaining — pr.threads.list default first (Slice A)", () => {
  it("2-step chain omitting first defaults first to 30 in GraphQL batch variables", async () => {
    // Batch queries use githubClient.query, not queryRaw.
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: makeThreadsResult(),
      step1: makeThreadsResult(),
    })

    const result = await executeTasks(
      [
        { task: "pr.threads.list", input: { owner: "acme", name: "repo", prNumber: 1 } },
        { task: "pr.threads.list", input: { owner: "acme", name: "repo", prNumber: 2 } },
      ],
      {
        githubClient: createGithubClient({ query: queryMock }),
        skipGhPreflight: true,
      },
    )

    expect(result.status).toBe("success")
    expect(queryMock).toHaveBeenCalledTimes(1)
    const vars = queryMock.mock.calls[0]?.[1] as Record<string, unknown>
    // AJV useDefaults injected first:30 into each step's input before buildOperationVars ran
    expect(vars.step0_first).toBe(30)
    expect(vars.step1_first).toBe(30)
  })

  it("2-step chain with explicit first passes that value through", async () => {
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: makeThreadsResult(),
      step1: makeThreadsResult(),
    })

    const result = await executeTasks(
      [
        { task: "pr.threads.list", input: { owner: "acme", name: "repo", prNumber: 1, first: 10 } },
        { task: "pr.threads.list", input: { owner: "acme", name: "repo", prNumber: 2, first: 5 } },
      ],
      {
        githubClient: createGithubClient({ query: queryMock }),
        skipGhPreflight: true,
      },
    )

    expect(result.status).toBe("success")
    expect(queryMock).toHaveBeenCalledTimes(1)
    const vars = queryMock.mock.calls[0]?.[1] as Record<string, unknown>
    expect(vars.step0_first).toBe(10)
    expect(vars.step1_first).toBe(5)
  })
})

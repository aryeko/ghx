import { executeTasks } from "@core/core/routing/engine/index.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"

// Regression target: a `ghx chain` step for `pr.threads.list` that omits `first`
// must NOT fail with "Variable $first of type Int! was provided invalid value".
// The fix: AJV useDefaults injects first:30 at the validation boundary (runPreflight)
// so both the `run` path and the `chain` path get the default automatically.
//
// `pr.threads.list` is in SINGLE_HANDLER_GRAPHQL_TASKS because it does multi-page
// cursor scanning that cannot be reproduced in a single batched page. Each step runs
// via runSingleTask → fetchPrCommentsList (not through the batch query path).

const makeThreadsResult = () => ({
  items: [],
  pageInfo: { hasNextPage: false, endCursor: null },
  filterApplied: { unresolvedOnly: true, includeOutdated: false },
  scan: { pagesScanned: 1, sourceItemsScanned: 0, scanTruncated: false },
})

describe("executeTasks chaining — pr.threads.list default first (Slice A)", () => {
  it("2-step chain omitting first defaults first to 30 passed to fetchPrCommentsList", async () => {
    const queryMock = vi.fn()
    const fetchPrCommentsList = vi.fn().mockResolvedValue(makeThreadsResult())

    const result = await executeTasks(
      [
        { task: "pr.threads.list", input: { owner: "acme", name: "repo", prNumber: 1 } },
        { task: "pr.threads.list", input: { owner: "acme", name: "repo", prNumber: 2 } },
      ],
      {
        githubClient: createGithubClient({
          fetchPrCommentsList,
          query: queryMock,
          queryRaw: vi.fn(),
        }),
        skipGhPreflight: true,
      },
    )

    expect(result.status).toBe("success")
    // Single-handler steps do not go through the batch query path
    expect(queryMock).not.toHaveBeenCalled()
    expect(fetchPrCommentsList).toHaveBeenCalledTimes(2)
    // AJV useDefaults injected first:30 into each step's input before runSingleTask ran
    expect(fetchPrCommentsList).toHaveBeenNthCalledWith(1, {
      owner: "acme",
      name: "repo",
      prNumber: 1,
      first: 30,
    })
    expect(fetchPrCommentsList).toHaveBeenNthCalledWith(2, {
      owner: "acme",
      name: "repo",
      prNumber: 2,
      first: 30,
    })
  })

  it("2-step chain with explicit first passes that value through to fetchPrCommentsList", async () => {
    const queryMock = vi.fn()
    const fetchPrCommentsList = vi.fn().mockResolvedValue(makeThreadsResult())

    const result = await executeTasks(
      [
        {
          task: "pr.threads.list",
          input: { owner: "acme", name: "repo", prNumber: 1, first: 10 },
        },
        {
          task: "pr.threads.list",
          input: { owner: "acme", name: "repo", prNumber: 2, first: 5 },
        },
      ],
      {
        githubClient: createGithubClient({
          fetchPrCommentsList,
          query: queryMock,
          queryRaw: vi.fn(),
        }),
        skipGhPreflight: true,
      },
    )

    expect(result.status).toBe("success")
    expect(queryMock).not.toHaveBeenCalled()
    expect(fetchPrCommentsList).toHaveBeenCalledTimes(2)
    expect(fetchPrCommentsList).toHaveBeenNthCalledWith(1, {
      owner: "acme",
      name: "repo",
      prNumber: 1,
      first: 10,
    })
    expect(fetchPrCommentsList).toHaveBeenNthCalledWith(2, {
      owner: "acme",
      name: "repo",
      prNumber: 2,
      first: 5,
    })
  })
})

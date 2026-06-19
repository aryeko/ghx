import { executeTasks } from "@core/core/routing/engine/index.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"

describe("executeTasks chaining - pr.comments.reactions.list defaults", () => {
  it("applies standard first defaults before running non-batchable handlers", async () => {
    const queryMock = vi.fn()
    const fetchPrCommentsReactionsList = vi.fn().mockResolvedValue({
      items: [],
      filterApplied: { reactorLogin: null, content: null },
      pageInfo: { hasNextPage: false, endCursor: null },
      scan: { pagesScanned: 0, sourceItemsScanned: 0, scanTruncated: false },
    })

    const result = await executeTasks(
      [
        {
          task: "pr.comments.reactions.list",
          input: { owner: "acme", name: "repo", prNumber: 1 },
        },
        {
          task: "pr.comments.reactions.list",
          input: {
            owner: "acme",
            name: "repo",
            prNumber: 2,
            first: 10,
          },
        },
      ],
      {
        githubToken: "test-token",
        githubClient: createGithubClient({
          fetchPrCommentsReactionsList,
          query: queryMock,
          queryRaw: vi.fn(),
        }),
      },
    )

    expect(queryMock).not.toHaveBeenCalled()
    expect(fetchPrCommentsReactionsList).toHaveBeenCalledTimes(2)
    expect(fetchPrCommentsReactionsList).toHaveBeenNthCalledWith(1, {
      owner: "acme",
      name: "repo",
      prNumber: 1,
      first: 30,
    })
    expect(fetchPrCommentsReactionsList).toHaveBeenNthCalledWith(2, {
      owner: "acme",
      name: "repo",
      prNumber: 2,
      first: 10,
    })
    expect(result.status).toBe("success")
  })
})

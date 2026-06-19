import { executeTasks } from "@core/core/routing/engine/index.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"

describe("executeTasks chaining - pr.comments.reactions.list defaults", () => {
  it("applies default page sizes before building batched query variables", async () => {
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: {
        pullRequest: {
          comments: { pageInfo: { hasNextPage: false }, nodes: [] },
          reviewThreads: { pageInfo: { hasNextPage: false }, nodes: [] },
        },
      },
      step1: {
        pullRequest: {
          comments: { pageInfo: { hasNextPage: false }, nodes: [] },
          reviewThreads: { pageInfo: { hasNextPage: false }, nodes: [] },
        },
      },
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
            commentsFirst: 10,
            threadsFirst: 20,
            threadCommentsFirst: 5,
          },
        },
      ],
      {
        githubClient: createGithubClient({
          query: queryMock,
          queryRaw: vi.fn(),
        }),
      },
    )

    expect(queryMock).toHaveBeenCalledTimes(1)
    const queryVars = queryMock.mock.calls[0]?.[1] as Record<string, unknown>
    expect(queryVars.step0_commentsFirst).toBe(30)
    expect(queryVars.step0_threadsFirst).toBe(30)
    expect(queryVars.step0_threadCommentsFirst).toBe(30)
    expect(queryVars.step1_commentsFirst).toBe(10)
    expect(queryVars.step1_threadsFirst).toBe(20)
    expect(queryVars.step1_threadCommentsFirst).toBe(5)
    expect(result.status).toBe("success")
  })
})

import { executeTasks } from "@core/core/routing/engine/index.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"

describe("executeTasks chaining - pr.reviews.submit variable contract", () => {
  it("normalizes review event and draft thread sides before batching", async () => {
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: { pullRequest: { id: "PR_0" } },
      step1: { pullRequest: { id: "PR_1" } },
    })

    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: {
          addPullRequestReview: {
            pullRequestReview: {
              id: "REVIEW_0",
              state: "APPROVED",
              url: "https://github.com/acme/repo/pull/1#pullrequestreview-1",
              body: "",
            },
          },
        },
        step1: {
          addPullRequestReview: {
            pullRequestReview: {
              id: "REVIEW_1",
              state: "COMMENTED",
              url: "https://github.com/acme/repo/pull/2#pullrequestreview-2",
              body: "Looks close",
            },
          },
        },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        {
          task: "pr.reviews.submit",
          input: {
            owner: "acme",
            name: "repo",
            prNumber: 1,
            event: "approve",
          },
        },
        {
          task: "pr.reviews.submit",
          input: {
            owner: "acme",
            name: "repo",
            prNumber: 2,
            event: "comment",
            body: "Looks close",
            comments: [
              {
                path: "src/app.ts",
                body: "Please adjust this range.",
                line: 42,
                side: "right",
                startLine: 40,
                startSide: "left",
              },
            ],
          },
        },
      ],
      {
        githubClient: createGithubClient({
          query: queryMock,
          queryRaw: queryRawMock,
        }),
      },
    )

    expect(queryRawMock).toHaveBeenCalledTimes(1)
    const mutationVars = queryRawMock.mock.calls[0]?.[1] as Record<string, unknown>
    expect(mutationVars.step0_pullRequestId).toBe("PR_0")
    expect(mutationVars.step0_event).toBe("APPROVE")
    expect(mutationVars).not.toHaveProperty("step0_threads")
    expect(mutationVars.step1_pullRequestId).toBe("PR_1")
    expect(mutationVars.step1_event).toBe("COMMENT")
    expect(mutationVars.step1_body).toBe("Looks close")
    expect(mutationVars.step1_threads).toEqual([
      {
        path: "src/app.ts",
        body: "Please adjust this range.",
        line: 42,
        side: "RIGHT",
        startLine: 40,
        startSide: "LEFT",
      },
    ])
    expect(result.status).toBe("success")
  })
})

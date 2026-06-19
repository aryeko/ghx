import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine/index.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask pr.comments.reactions.list", () => {
  it("returns validation error envelope for missing prNumber", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "pr.comments.reactions.list",
      input: {
        owner: "go-modkit",
        name: "modkit",
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.meta.reason).toBe("INPUT_VALIDATION")
  })

  it("maps issue + review-thread comment reactions and omits reaction-less comments", async () => {
    let executeCount = 0
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        executeCount += 1
        if (executeCount === 1) {
          return {
            repository: {
              pullRequest: {
                comments: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      __typename: "IssueComment",
                      id: "IC_1",
                      url: "https://github.com/go-modkit/modkit/pull/7#issuecomment-1",
                      author: { login: "alice" },
                      reactionGroups: [
                        {
                          content: "THUMBS_UP",
                          viewerHasReacted: false,
                          reactors: {
                            totalCount: 1,
                            nodes: [{ __typename: "User", login: "bob" }],
                          },
                        },
                      ],
                    },
                    {
                      __typename: "IssueComment",
                      id: "IC_2",
                      url: "https://github.com/go-modkit/modkit/pull/7#issuecomment-2",
                      author: { login: "carol" },
                      reactionGroups: [],
                    },
                    null,
                  ],
                },
              },
            },
          } as TData
        }

        return {
          repository: {
            pullRequest: {
              reviewThreads: {
                pageInfo: { hasNextPage: false, endCursor: null },
                edges: [
                  {
                    cursor: "thread-cursor-1",
                    node: {
                      id: "THREAD_1",
                      comments: {
                        pageInfo: { hasNextPage: false, endCursor: null },
                        nodes: [
                          {
                            __typename: "PullRequestReviewComment",
                            id: "PRRC_1",
                            url: "https://github.com/go-modkit/modkit/pull/7#discussion_r1",
                            author: { login: "dave" },
                            reactionGroups: [
                              {
                                content: "ROCKET",
                                viewerHasReacted: true,
                                reactors: {
                                  totalCount: 5,
                                  nodes: [{ __typename: "User", login: "erin" }],
                                },
                              },
                            ],
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        } as TData
      },
    })

    const request: TaskRequest = {
      task: "pr.comments.reactions.list",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 7,
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      items: [
        {
          subjectType: "IssueComment",
          subjectId: "IC_1",
          subjectUrl: "https://github.com/go-modkit/modkit/pull/7#issuecomment-1",
          authorLogin: "alice",
          groups: [
            {
              content: "THUMBS_UP",
              reactorCount: 1,
              reactorLogins: ["bob"],
              viewerHasReacted: false,
              reactorsTruncated: false,
            },
          ],
        },
        {
          subjectType: "PullRequestReviewComment",
          subjectId: "PRRC_1",
          subjectUrl: "https://github.com/go-modkit/modkit/pull/7#discussion_r1",
          authorLogin: "dave",
          groups: [
            {
              content: "ROCKET",
              reactorCount: 5,
              reactorLogins: ["erin"],
              viewerHasReacted: true,
              reactorsTruncated: true,
            },
          ],
        },
      ],
      filterApplied: { reactorLogin: null, content: null },
      pageInfo: { hasNextPage: false, endCursor: null },
      scan: {
        pagesScanned: 2,
        sourceItemsScanned: 4,
        scanTruncated: false,
      },
    })
  })
})

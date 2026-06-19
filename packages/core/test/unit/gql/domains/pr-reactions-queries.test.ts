import { runPrCommentsReactionsList, runPrReactionsList } from "@core/gql/domains/pr-queries.js"
import type { GraphqlTransport } from "@core/gql/transport.js"
import { describe, expect, it, vi } from "vitest"

const baseReactionsInput = {
  owner: "acme",
  name: "repo",
  prNumber: 42,
}

const baseCommentsInput = {
  owner: "acme",
  name: "repo",
  prNumber: 42,
}

function reactionsResponse(reactionGroups: unknown[]) {
  return {
    repository: {
      pullRequest: {
        id: "PR_1",
        url: "https://github.com/acme/repo/pull/42",
        reactionGroups,
      },
    },
  }
}

describe("runPrReactionsList", () => {
  it("extracts reactor logins across the Reactor union and drops null / login-less nodes", async () => {
    const execute = vi.fn().mockResolvedValue(
      reactionsResponse([
        {
          content: "THUMBS_UP",
          viewerHasReacted: true,
          reactors: {
            totalCount: 4,
            nodes: [
              { __typename: "User", login: "alice" },
              { __typename: "Bot", login: "dependabot" },
              { __typename: "Organization", login: "acme-org" },
              { __typename: "Mannequin", login: "ghost" },
              null,
              { __typename: "User", login: "" },
            ],
          },
        },
      ]),
    )
    const transport: GraphqlTransport = { execute }

    const result = await runPrReactionsList(transport, baseReactionsInput)

    expect(result.subject).toEqual({
      type: "PullRequest",
      id: "PR_1",
      url: "https://github.com/acme/repo/pull/42",
    })
    expect(result.items).toEqual([
      {
        content: "THUMBS_UP",
        reactorCount: 4,
        reactorLogins: ["alice", "dependabot", "acme-org", "ghost"],
        viewerHasReacted: true,
        reactorsTruncated: false,
      },
    ])
    expect(result.filterApplied).toEqual({ reactorLogin: null, content: null })
  })

  it("flags reactorsTruncated when totalCount exceeds collected logins", async () => {
    const execute = vi.fn().mockResolvedValue(
      reactionsResponse([
        {
          content: "HEART",
          viewerHasReacted: false,
          reactors: {
            totalCount: 10,
            nodes: [{ __typename: "User", login: "alice" }],
          },
        },
      ]),
    )
    const transport: GraphqlTransport = { execute }

    const result = await runPrReactionsList(transport, baseReactionsInput)

    expect(result.items[0]?.reactorsTruncated).toBe(true)
    expect(result.items[0]?.reactorCount).toBe(10)
    expect(result.items[0]?.reactorLogins).toEqual(["alice"])
  })

  it("keeps only the matching group when content filter is applied", async () => {
    const execute = vi.fn().mockResolvedValue(
      reactionsResponse([
        {
          content: "THUMBS_UP",
          viewerHasReacted: false,
          reactors: { totalCount: 1, nodes: [{ __typename: "User", login: "alice" }] },
        },
        {
          content: "HEART",
          viewerHasReacted: false,
          reactors: { totalCount: 1, nodes: [{ __typename: "User", login: "bob" }] },
        },
      ]),
    )
    const transport: GraphqlTransport = { execute }

    const result = await runPrReactionsList(transport, { ...baseReactionsInput, content: "HEART" })

    expect(result.items).toEqual([
      {
        content: "HEART",
        reactorCount: 1,
        reactorLogins: ["bob"],
        viewerHasReacted: false,
        reactorsTruncated: false,
      },
    ])
    expect(result.filterApplied).toEqual({ reactorLogin: null, content: "HEART" })
  })

  it("keeps group with [reactorLogin] and full count when reactorLogin reacted", async () => {
    const execute = vi.fn().mockResolvedValue(
      reactionsResponse([
        {
          content: "THUMBS_UP",
          viewerHasReacted: false,
          reactors: {
            totalCount: 3,
            nodes: [
              { __typename: "User", login: "alice" },
              { __typename: "User", login: "bob" },
            ],
          },
        },
      ]),
    )
    const transport: GraphqlTransport = { execute }

    const result = await runPrReactionsList(transport, {
      ...baseReactionsInput,
      reactorLogin: "alice",
    })

    expect(result.items).toEqual([
      {
        content: "THUMBS_UP",
        reactorCount: 3,
        reactorLogins: ["alice"],
        viewerHasReacted: false,
        reactorsTruncated: true,
      },
    ])
    expect(result.filterApplied).toEqual({ reactorLogin: "alice", content: null })
  })

  it("drops a group when reactorLogin did not react", async () => {
    const execute = vi.fn().mockResolvedValue(
      reactionsResponse([
        {
          content: "THUMBS_UP",
          viewerHasReacted: false,
          reactors: { totalCount: 1, nodes: [{ __typename: "User", login: "alice" }] },
        },
      ]),
    )
    const transport: GraphqlTransport = { execute }

    const result = await runPrReactionsList(transport, {
      ...baseReactionsInput,
      reactorLogin: "nobody",
    })

    expect(result.items).toEqual([])
  })

  it("handles null reactionGroups and null reactor nodes arrays", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        pullRequest: {
          id: "PR_1",
          url: "https://github.com/acme/repo/pull/42",
          reactionGroups: null,
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runPrReactionsList(transport, baseReactionsInput)

    expect(result.items).toEqual([])
  })

  it("treats a group with null reactor nodes as having zero collected logins", async () => {
    const execute = vi.fn().mockResolvedValue(
      reactionsResponse([
        {
          content: "EYES",
          viewerHasReacted: false,
          reactors: { totalCount: 2, nodes: null },
        },
      ]),
    )
    const transport: GraphqlTransport = { execute }

    const result = await runPrReactionsList(transport, baseReactionsInput)

    expect(result.items).toEqual([
      {
        content: "EYES",
        reactorCount: 2,
        reactorLogins: [],
        viewerHasReacted: false,
        reactorsTruncated: true,
      },
    ])
  })

  it("throws when the pull request is not found", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runPrReactionsList(transport, baseReactionsInput)).rejects.toThrow(
      "Pull request not found",
    )
  })

  it("only passes owner/name/prNumber to the query", async () => {
    const execute = vi.fn().mockResolvedValue(reactionsResponse([]))
    const transport: GraphqlTransport = { execute }

    await runPrReactionsList(transport, {
      ...baseReactionsInput,
      content: "THUMBS_UP",
      reactorLogin: "alice",
    })

    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute.mock.calls[0]?.[1]).toEqual({
      owner: "acme",
      name: "repo",
      prNumber: 42,
    })
  })

  it("rejects invalid content via assertion before querying", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runPrReactionsList(transport, {
        ...baseReactionsInput,
        content: "INVALID" as never,
      }),
    ).rejects.toThrow("content must be one of")
    expect(execute).not.toHaveBeenCalled()
  })

  it("rejects an empty reactorLogin via assertion", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runPrReactionsList(transport, { ...baseReactionsInput, reactorLogin: "   " }),
    ).rejects.toThrow("reactorLogin must be a non-empty string")
    expect(execute).not.toHaveBeenCalled()
  })

  it("rejects a non-positive prNumber via assertion", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runPrReactionsList(transport, { ...baseReactionsInput, prNumber: 0 }),
    ).rejects.toThrow("PR number must be a positive integer")
    expect(execute).not.toHaveBeenCalled()
  })

  it("rejects a missing owner via assertion", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runPrReactionsList(transport, {
        ...baseReactionsInput,
        owner: "" as string,
      }),
    ).rejects.toThrow("Repository owner and name are required")
    expect(execute).not.toHaveBeenCalled()
  })
})

function commentsResponse(options: {
  comments?: { hasNextPage?: boolean; nodes?: unknown[] }
  reviewThreads?: { hasNextPage?: boolean; nodes?: unknown[] }
}) {
  return {
    repository: {
      pullRequest: {
        comments: {
          pageInfo: { hasNextPage: options.comments?.hasNextPage ?? false },
          nodes: options.comments?.nodes ?? [],
        },
        reviewThreads: {
          pageInfo: { hasNextPage: options.reviewThreads?.hasNextPage ?? false },
          nodes: options.reviewThreads?.nodes ?? [],
        },
      },
    },
  }
}

describe("runPrCommentsReactionsList", () => {
  it("maps issue comments and tags subjectType as IssueComment", async () => {
    const execute = vi.fn().mockResolvedValue(
      commentsResponse({
        comments: {
          nodes: [
            {
              __typename: "IssueComment",
              id: "IC_1",
              url: "https://example.test/ic1",
              author: { login: "alice" },
              reactionGroups: [
                {
                  content: "THUMBS_UP",
                  viewerHasReacted: false,
                  reactors: { totalCount: 1, nodes: [{ __typename: "User", login: "bob" }] },
                },
              ],
            },
          ],
        },
      }),
    )
    const transport: GraphqlTransport = { execute }

    const result = await runPrCommentsReactionsList(transport, baseCommentsInput)

    expect(result.items).toEqual([
      {
        subjectType: "IssueComment",
        subjectId: "IC_1",
        subjectUrl: "https://example.test/ic1",
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
    ])
    expect(result.scan).toEqual({
      commentsTruncated: false,
      threadsTruncated: false,
      threadCommentsTruncated: false,
    })
  })

  it("omits comments with no matching reaction groups", async () => {
    const execute = vi.fn().mockResolvedValue(
      commentsResponse({
        comments: {
          nodes: [
            {
              __typename: "IssueComment",
              id: "IC_empty",
              url: "https://example.test/empty",
              author: { login: "alice" },
              reactionGroups: [],
            },
            null,
            {
              __typename: "IssueComment",
              id: "IC_keep",
              url: "https://example.test/keep",
              author: null,
              reactionGroups: [
                {
                  content: "HEART",
                  viewerHasReacted: false,
                  reactors: { totalCount: 1, nodes: [{ __typename: "User", login: "carol" }] },
                },
              ],
            },
          ],
        },
      }),
    )
    const transport: GraphqlTransport = { execute }

    const result = await runPrCommentsReactionsList(transport, baseCommentsInput)

    expect(result.items.map((i) => i.subjectId)).toEqual(["IC_keep"])
    expect(result.items[0]?.authorLogin).toBeNull()
  })

  it("tags review-thread comments as PullRequestReviewComment and sets threadCommentsTruncated", async () => {
    const execute = vi.fn().mockResolvedValue(
      commentsResponse({
        reviewThreads: {
          nodes: [
            null,
            {
              comments: {
                pageInfo: { hasNextPage: true },
                nodes: [
                  {
                    __typename: "PullRequestReviewComment",
                    id: "PRRC_1",
                    url: "https://example.test/prrc1",
                    author: null,
                    reactionGroups: [
                      {
                        content: "ROCKET",
                        viewerHasReacted: true,
                        reactors: { totalCount: 1, nodes: [{ __typename: "User", login: "erin" }] },
                      },
                    ],
                  },
                  null,
                ],
              },
            },
          ],
        },
      }),
    )
    const transport: GraphqlTransport = { execute }

    const result = await runPrCommentsReactionsList(transport, baseCommentsInput)

    expect(result.items).toEqual([
      {
        subjectType: "PullRequestReviewComment",
        subjectId: "PRRC_1",
        subjectUrl: "https://example.test/prrc1",
        authorLogin: null,
        groups: [
          {
            content: "ROCKET",
            reactorCount: 1,
            reactorLogins: ["erin"],
            viewerHasReacted: true,
            reactorsTruncated: false,
          },
        ],
      },
    ])
    expect(result.scan.threadCommentsTruncated).toBe(true)
  })

  it("omits review-thread comments with no matching reaction groups", async () => {
    const execute = vi.fn().mockResolvedValue(
      commentsResponse({
        reviewThreads: {
          nodes: [
            {
              comments: {
                pageInfo: { hasNextPage: false },
                nodes: [
                  {
                    __typename: "PullRequestReviewComment",
                    id: "PRRC_empty",
                    url: "https://example.test/prrc-empty",
                    author: { login: "dave" },
                    reactionGroups: [],
                  },
                ],
              },
            },
          ],
        },
      }),
    )
    const transport: GraphqlTransport = { execute }

    const result = await runPrCommentsReactionsList(transport, baseCommentsInput)

    expect(result.items).toEqual([])
    expect(result.scan.threadCommentsTruncated).toBe(false)
  })

  it("propagates scan truncation flags from page info", async () => {
    const execute = vi.fn().mockResolvedValue(
      commentsResponse({
        comments: { hasNextPage: true, nodes: [] },
        reviewThreads: { hasNextPage: true, nodes: [] },
      }),
    )
    const transport: GraphqlTransport = { execute }

    const result = await runPrCommentsReactionsList(transport, baseCommentsInput)

    expect(result.scan).toEqual({
      commentsTruncated: true,
      threadsTruncated: true,
      threadCommentsTruncated: false,
    })
  })

  it("handles null node arrays and null reactionGroups defensively", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        pullRequest: {
          comments: {
            pageInfo: { hasNextPage: false },
            nodes: null,
          },
          reviewThreads: {
            pageInfo: { hasNextPage: false },
            nodes: [
              {
                comments: {
                  pageInfo: { hasNextPage: false },
                  nodes: [
                    {
                      __typename: "PullRequestReviewComment",
                      id: "PRRC_null_groups",
                      url: "https://example.test/null-groups",
                      author: { login: "dave" },
                      reactionGroups: null,
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runPrCommentsReactionsList(transport, baseCommentsInput)

    expect(result.items).toEqual([])
  })

  it("handles null reviewThreads node array defensively", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        pullRequest: {
          comments: {
            pageInfo: { hasNextPage: false },
            nodes: [
              {
                __typename: "IssueComment",
                id: "IC_null_groups",
                url: "https://example.test/ic-null",
                author: { login: "alice" },
                reactionGroups: null,
              },
            ],
          },
          reviewThreads: {
            pageInfo: { hasNextPage: false },
            nodes: null,
          },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runPrCommentsReactionsList(transport, baseCommentsInput)

    expect(result.items).toEqual([])
  })

  it("handles null thread comment node array defensively", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        pullRequest: {
          comments: { pageInfo: { hasNextPage: false }, nodes: [] },
          reviewThreads: {
            pageInfo: { hasNextPage: false },
            nodes: [
              {
                comments: {
                  pageInfo: { hasNextPage: false },
                  nodes: null,
                },
              },
            ],
          },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runPrCommentsReactionsList(transport, baseCommentsInput)

    expect(result.items).toEqual([])
  })

  it("applies content + reactorLogin filters to comment groups", async () => {
    const execute = vi.fn().mockResolvedValue(
      commentsResponse({
        comments: {
          nodes: [
            {
              __typename: "IssueComment",
              id: "IC_1",
              url: "https://example.test/ic1",
              author: { login: "alice" },
              reactionGroups: [
                {
                  content: "THUMBS_UP",
                  viewerHasReacted: false,
                  reactors: {
                    totalCount: 2,
                    nodes: [
                      { __typename: "User", login: "bob" },
                      { __typename: "User", login: "carol" },
                    ],
                  },
                },
                {
                  content: "HEART",
                  viewerHasReacted: false,
                  reactors: { totalCount: 1, nodes: [{ __typename: "User", login: "bob" }] },
                },
              ],
            },
            {
              __typename: "IssueComment",
              id: "IC_2",
              url: "https://example.test/ic2",
              author: { login: "zoe" },
              reactionGroups: [
                {
                  content: "THUMBS_UP",
                  viewerHasReacted: false,
                  reactors: { totalCount: 1, nodes: [{ __typename: "User", login: "carol" }] },
                },
              ],
            },
          ],
        },
      }),
    )
    const transport: GraphqlTransport = { execute }

    const result = await runPrCommentsReactionsList(transport, {
      ...baseCommentsInput,
      content: "THUMBS_UP",
      reactorLogin: "bob",
    })

    // IC_2's only THUMBS_UP group has no "bob" → dropped, so IC_2 is omitted entirely.
    expect(result.items).toEqual([
      {
        subjectType: "IssueComment",
        subjectId: "IC_1",
        subjectUrl: "https://example.test/ic1",
        authorLogin: "alice",
        groups: [
          {
            content: "THUMBS_UP",
            reactorCount: 2,
            reactorLogins: ["bob"],
            viewerHasReacted: false,
            reactorsTruncated: false,
          },
        ],
      },
    ])
    expect(result.filterApplied).toEqual({ reactorLogin: "bob", content: "THUMBS_UP" })
  })

  it("applies page-size defaults of 30 when not provided", async () => {
    const execute = vi.fn().mockResolvedValue(commentsResponse({}))
    const transport: GraphqlTransport = { execute }

    await runPrCommentsReactionsList(transport, baseCommentsInput)

    expect(execute.mock.calls[0]?.[1]).toEqual({
      owner: "acme",
      name: "repo",
      prNumber: 42,
      commentsFirst: 30,
      threadsFirst: 30,
      threadCommentsFirst: 30,
    })
  })

  it("forwards explicit page sizes", async () => {
    const execute = vi.fn().mockResolvedValue(commentsResponse({}))
    const transport: GraphqlTransport = { execute }

    await runPrCommentsReactionsList(transport, {
      ...baseCommentsInput,
      commentsFirst: 10,
      threadsFirst: 20,
      threadCommentsFirst: 5,
    })

    expect(execute.mock.calls[0]?.[1]).toMatchObject({
      commentsFirst: 10,
      threadsFirst: 20,
      threadCommentsFirst: 5,
    })
  })

  it("throws when the pull request is not found", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runPrCommentsReactionsList(transport, baseCommentsInput)).rejects.toThrow(
      "Pull request not found",
    )
  })

  it("rejects an out-of-range commentsFirst via assertion", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runPrCommentsReactionsList(transport, { ...baseCommentsInput, commentsFirst: 101 }),
    ).rejects.toThrow("commentsFirst must be an integer between 1 and 100")
    expect(execute).not.toHaveBeenCalled()
  })

  it("rejects an out-of-range threadsFirst via assertion", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runPrCommentsReactionsList(transport, { ...baseCommentsInput, threadsFirst: 0 }),
    ).rejects.toThrow("threadsFirst must be an integer between 1 and 100")
    expect(execute).not.toHaveBeenCalled()
  })

  it("rejects invalid content via assertion", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runPrCommentsReactionsList(transport, {
        ...baseCommentsInput,
        content: "NOPE" as never,
      }),
    ).rejects.toThrow("content must be one of")
    expect(execute).not.toHaveBeenCalled()
  })

  it("rejects a missing prNumber via assertion", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runPrCommentsReactionsList(transport, {
        owner: "acme",
        name: "repo",
        prNumber: undefined as unknown as number,
      }),
    ).rejects.toThrow("PR number must be a positive integer")
    expect(execute).not.toHaveBeenCalled()
  })

  it("rejects a missing owner via assertion", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runPrCommentsReactionsList(transport, { ...baseCommentsInput, owner: "" as string }),
    ).rejects.toThrow("Repository owner and name are required")
    expect(execute).not.toHaveBeenCalled()
  })
})

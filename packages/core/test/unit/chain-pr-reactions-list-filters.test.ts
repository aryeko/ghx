import { executeTasks } from "@core/core/routing/engine/index.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"

describe("executeTasks chaining - PR reaction filters", () => {
  it("normalizes and filters pull request reactions in batched query results", async () => {
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: {
        pullRequest: {
          id: "PR_1",
          url: "https://github.com/acme/repo/pull/1",
          reactionGroups: [
            {
              content: "THUMBS_UP",
              viewerHasReacted: false,
              reactors: {
                totalCount: 2,
                nodes: [
                  { __typename: "User", login: "alice" },
                  { __typename: "User", login: "bob" },
                ],
              },
            },
            {
              content: "HEART",
              viewerHasReacted: true,
              reactors: { totalCount: 1, nodes: [{ __typename: "User", login: "bob" }] },
            },
          ],
        },
      },
      step1: {
        pullRequest: {
          id: "PR_2",
          url: "https://github.com/acme/repo/pull/2",
          reactionGroups: [
            {
              content: "ROCKET",
              viewerHasReacted: false,
              reactors: { totalCount: 1, nodes: [{ __typename: "User", login: "carol" }] },
            },
          ],
        },
      },
    })

    const result = await executeTasks(
      [
        {
          task: "pr.reactions.list",
          input: {
            owner: "acme",
            name: "repo",
            prNumber: 1,
            content: "THUMBS_UP",
            reactorLogin: "bob",
          },
        },
        {
          task: "pr.reactions.list",
          input: { owner: "acme", name: "repo", prNumber: 2, reactorLogin: "nobody" },
        },
      ],
      {
        githubClient: createGithubClient({
          query: queryMock,
          queryRaw: vi.fn(),
        }),
      },
    )

    expect(result.status).toBe("success")
    expect(result.results[0]).toMatchObject({
      ok: true,
      data: {
        subject: { type: "PullRequest", id: "PR_1", url: "https://github.com/acme/repo/pull/1" },
        items: [
          {
            content: "THUMBS_UP",
            reactorCount: 2,
            reactorLogins: ["bob"],
            viewerHasReacted: false,
            reactorsTruncated: false,
          },
        ],
        filterApplied: { reactorLogin: "bob", content: "THUMBS_UP" },
      },
    })
    expect(result.results[1]).toMatchObject({
      ok: true,
      data: {
        subject: { type: "PullRequest", id: "PR_2", url: "https://github.com/acme/repo/pull/2" },
        items: [],
        filterApplied: { reactorLogin: "nobody", content: null },
      },
    })
  })

  it("normalizes and filters pull request comment reactions in batched query results", async () => {
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: {
        pullRequest: {
          comments: {
            pageInfo: { hasNextPage: false },
            nodes: [
              {
                __typename: "IssueComment",
                id: "IC_1",
                url: "https://github.com/acme/repo/pull/1#issuecomment-1",
                author: { login: "alice" },
                reactionGroups: [
                  {
                    content: "HEART",
                    viewerHasReacted: true,
                    reactors: {
                      totalCount: 2,
                      nodes: [
                        { __typename: "User", login: "bob" },
                        { __typename: "User", login: "carol" },
                      ],
                    },
                  },
                ],
              },
              {
                __typename: "IssueComment",
                id: "IC_2",
                url: "https://github.com/acme/repo/pull/1#issuecomment-2",
                author: { login: "dave" },
                reactionGroups: [
                  {
                    content: "THUMBS_UP",
                    viewerHasReacted: false,
                    reactors: { totalCount: 1, nodes: [{ __typename: "User", login: "erin" }] },
                  },
                ],
              },
            ],
          },
          reviewThreads: {
            pageInfo: { hasNextPage: false },
            nodes: [
              {
                comments: {
                  pageInfo: { hasNextPage: true },
                  nodes: [
                    {
                      __typename: "PullRequestReviewComment",
                      id: "RC_1",
                      url: "https://github.com/acme/repo/pull/1#discussion_r1",
                      author: null,
                      reactionGroups: [
                        {
                          content: "HEART",
                          viewerHasReacted: false,
                          reactors: {
                            totalCount: 1,
                            nodes: [{ __typename: "User", login: "bob" }],
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
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
          input: {
            owner: "acme",
            name: "repo",
            prNumber: 1,
            content: "HEART",
            reactorLogin: "bob",
          },
        },
        {
          task: "pr.comments.reactions.list",
          input: { owner: "acme", name: "repo", prNumber: 2 },
        },
      ],
      {
        githubClient: createGithubClient({
          query: queryMock,
          queryRaw: vi.fn(),
        }),
      },
    )

    expect(result.status).toBe("success")
    expect(result.results[0]).toMatchObject({
      ok: true,
      data: {
        items: [
          {
            subjectType: "IssueComment",
            subjectId: "IC_1",
            authorLogin: "alice",
            groups: [
              {
                content: "HEART",
                reactorCount: 2,
                reactorLogins: ["bob"],
                viewerHasReacted: true,
                reactorsTruncated: false,
              },
            ],
          },
          {
            subjectType: "PullRequestReviewComment",
            subjectId: "RC_1",
            authorLogin: null,
            groups: [
              {
                content: "HEART",
                reactorCount: 1,
                reactorLogins: ["bob"],
                viewerHasReacted: false,
                reactorsTruncated: false,
              },
            ],
          },
        ],
        filterApplied: { reactorLogin: "bob", content: "HEART" },
        scan: {
          commentsTruncated: false,
          threadsTruncated: false,
          threadCommentsTruncated: true,
        },
      },
    })
    expect(result.results[1]).toMatchObject({
      ok: true,
      data: {
        items: [],
        filterApplied: { reactorLogin: null, content: null },
        scan: {
          commentsTruncated: false,
          threadsTruncated: false,
          threadCommentsTruncated: false,
        },
      },
    })
  })
})

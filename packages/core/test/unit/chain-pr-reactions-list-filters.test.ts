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

  it("runs pull request comment reactions through non-batchable single handlers", async () => {
    const queryMock = vi.fn()
    const fetchPrCommentsReactionsList = vi
      .fn()
      .mockResolvedValueOnce({
        items: [
          {
            subjectType: "IssueComment",
            subjectId: "IC_1",
            subjectUrl: "https://github.com/acme/repo/pull/1#issuecomment-1",
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
            subjectUrl: "https://github.com/acme/repo/pull/1#discussion_r1",
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
        pageInfo: { hasNextPage: false, endCursor: null },
        scan: { pagesScanned: 2, sourceItemsScanned: 4, scanTruncated: false },
      })
      .mockResolvedValueOnce({
        items: [],
        filterApplied: { reactorLogin: null, content: null },
        pageInfo: { hasNextPage: false, endCursor: null },
        scan: { pagesScanned: 0, sourceItemsScanned: 0, scanTruncated: false },
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
        githubToken: "test-token",
        githubClient: createGithubClient({
          fetchPrCommentsReactionsList,
          query: queryMock,
          queryRaw: vi.fn(),
        }),
      },
    )

    expect(result.status).toBe("success")
    expect(queryMock).not.toHaveBeenCalled()
    expect(fetchPrCommentsReactionsList).toHaveBeenCalledTimes(2)
    expect(fetchPrCommentsReactionsList).toHaveBeenNthCalledWith(1, {
      owner: "acme",
      name: "repo",
      prNumber: 1,
      content: "HEART",
      reactorLogin: "bob",
      first: 30,
    })
    expect(fetchPrCommentsReactionsList).toHaveBeenNthCalledWith(2, {
      owner: "acme",
      name: "repo",
      prNumber: 2,
      first: 30,
    })
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
        pageInfo: { hasNextPage: false, endCursor: null },
        scan: { pagesScanned: 2, sourceItemsScanned: 4, scanTruncated: false },
      },
    })
    expect(result.results[1]).toMatchObject({
      ok: true,
      data: {
        items: [],
        filterApplied: { reactorLogin: null, content: null },
        pageInfo: { hasNextPage: false, endCursor: null },
        scan: { pagesScanned: 0, sourceItemsScanned: 0, scanTruncated: false },
      },
    })
  })
})

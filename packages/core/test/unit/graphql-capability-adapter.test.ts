import { describe, expect, it, vi } from "vitest"

import { runGraphqlCapability } from "../../src/core/execution/adapters/graphql-capability-adapter.js"

describe("runGraphqlCapability", () => {
  it("returns normalized data for supported capability", async () => {
    const client = {
      fetchRepoView: vi.fn(async () => ({
        id: "repo-id",
        name: "modkit",
        nameWithOwner: "acme/modkit",
        isPrivate: false,
        stargazerCount: 1,
        forkCount: 0,
        url: "https://github.com/acme/modkit",
        defaultBranch: "main"
      })),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn()
    }

    const result = await runGraphqlCapability(client, "repo.view", {
      owner: "acme",
      name: "modkit"
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toEqual(
      expect.objectContaining({
        id: "repo-id",
        nameWithOwner: "acme/modkit"
      })
    )
  })

  it("maps thrown client errors", async () => {
    const client = {
      fetchRepoView: vi.fn(async () => {
        throw new Error("network timeout")
      }),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn()
    }

    const result = await runGraphqlCapability(client, "repo.view", {
      owner: "acme",
      name: "modkit"
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("NETWORK")
    expect(result.error?.retryable).toBe(true)
  })

  it("routes issue.comments.list through the GraphQL client", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(async () => ({
        items: [
          {
            id: "comment-1",
            body: "looks good",
            authorLogin: "octocat",
            createdAt: "2025-01-01T00:00:00Z",
            url: "https://github.com/acme/modkit/issues/1#issuecomment-1"
          }
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: null
        }
      })),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn()
    }

    const result = await runGraphqlCapability(client, "issue.comments.list", {
      owner: "acme",
      name: "modkit",
      issueNumber: 1,
      first: 20
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: "comment-1", authorLogin: "octocat" })]
      })
    )
  })

  it("defaults first for list capabilities when omitted", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(async () => ({ items: [], pageInfo: { hasNextPage: false, endCursor: null } })),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(async () => ({ items: [], pageInfo: { hasNextPage: false, endCursor: null } })),
      fetchPrCommentsList: vi.fn(async () => ({
        items: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        filterApplied: { unresolvedOnly: false, includeOutdated: true },
        scan: { pagesScanned: 1, sourceItemsScanned: 0, scanTruncated: false }
      })),
      fetchPrReviewsList: vi.fn(async () => ({ items: [], pageInfo: { hasNextPage: false, endCursor: null } })),
      fetchPrDiffListFiles: vi.fn(async () => ({ items: [], pageInfo: { hasNextPage: false, endCursor: null } })),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn()
    }

    await runGraphqlCapability(client, "issue.list", {
      owner: "acme",
      name: "modkit"
    })

    await runGraphqlCapability(client, "pr.list", {
      owner: "acme",
      name: "modkit"
    })

    expect(client.fetchIssueList).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "acme", name: "modkit", first: 30 })
    )
    expect(client.fetchPrList).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "acme", name: "modkit", first: 30 })
    )
  })

  it("routes pr.comments.list through the GraphQL client", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      fetchPrCommentsList: vi.fn(async () => ({
        items: [
          {
            id: "thread-1",
            path: "src/index.ts",
            line: 10,
            startLine: null,
            diffSide: "RIGHT",
            subjectType: "LINE",
            isResolved: false,
            isOutdated: false,
            viewerCanReply: true,
            viewerCanResolve: true,
            viewerCanUnresolve: false,
            resolvedByLogin: null,
            comments: []
          }
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: null
        },
        filterApplied: {
          unresolvedOnly: true,
          includeOutdated: false
        },
        scan: {
          pagesScanned: 1,
          sourceItemsScanned: 1,
          scanTruncated: false
        }
      })),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn()
    }

    const result = await runGraphqlCapability(client, "pr.comments.list", {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
      unresolvedOnly: true,
      includeOutdated: false
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: "thread-1", isResolved: false })],
        filterApplied: {
          unresolvedOnly: true,
          includeOutdated: false
        }
      })
    )
  })

  it("routes pr.reviews.list through the GraphQL client", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(async () => ({
        items: [
          {
            id: "review-1",
            authorLogin: "octocat",
            body: "Looks good",
            state: "APPROVED",
            submittedAt: "2025-01-01T00:00:00Z",
            url: "https://example.com/review-1",
            commitOid: "abc123"
          }
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: null
        }
      })),
      fetchPrDiffListFiles: vi.fn(),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn()
    }

    const result = await runGraphqlCapability(client, "pr.reviews.list", {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
      first: 20
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ id: "review-1", state: "APPROVED" })]
      })
    )
  })

  it("routes pr.diff.list_files through the GraphQL client", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(async () => ({
        items: [
          {
            path: "src/index.ts",
            additions: 10,
            deletions: 2
          }
        ],
        pageInfo: {
          hasNextPage: false,
          endCursor: null
        }
      })),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn()
    }

    const result = await runGraphqlCapability(client, "pr.diff.list_files", {
      owner: "acme",
      name: "modkit",
      prNumber: 1,
      first: 20
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toEqual(
      expect.objectContaining({
        items: [expect.objectContaining({ path: "src/index.ts" })]
      })
    )
  })

  it("routes pr.comment.reply through the GraphQL client", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      replyToReviewThread: vi.fn(async () => ({ id: "thread-1", isResolved: false })),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn()
    }

    const result = await runGraphqlCapability(client, "pr.comment.reply", {
      threadId: "thread-1",
      body: "Thanks, addressed"
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({ id: "thread-1", isResolved: false })
  })

  it("routes pr.comment.resolve and pr.comment.unresolve through the GraphQL client", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(async () => ({ id: "thread-1", isResolved: true })),
      unresolveReviewThread: vi.fn(async () => ({ id: "thread-1", isResolved: false }))
    }

    const resolveResult = await runGraphqlCapability(client, "pr.comment.resolve", {
      threadId: "thread-1"
    })
    const unresolveResult = await runGraphqlCapability(client, "pr.comment.unresolve", {
      threadId: "thread-1"
    })

    expect(resolveResult.ok).toBe(true)
    expect(unresolveResult.ok).toBe(true)
    expect(resolveResult.data).toEqual({ id: "thread-1", isResolved: true })
    expect(unresolveResult.data).toEqual({ id: "thread-1", isResolved: false })
  })

  it("returns validation error for missing thread mutation inputs", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn()
    }

    const replyResult = await runGraphqlCapability(client, "pr.comment.reply", {
      threadId: "",
      body: "ok"
    })

    const resolveResult = await runGraphqlCapability(client, "pr.comment.resolve", {
      threadId: ""
    })

    expect(replyResult.ok).toBe(false)
    expect(resolveResult.ok).toBe(false)
    expect(replyResult.error?.code).toBe("VALIDATION")
    expect(resolveResult.error?.code).toBe("VALIDATION")
  })

  it("returns capability limit error for unsupported capability id", async () => {
    const client = {
      fetchRepoView: vi.fn(),
      fetchIssueView: vi.fn(),
      fetchIssueList: vi.fn(),
      fetchIssueCommentsList: vi.fn(),
      fetchPrView: vi.fn(),
      fetchPrList: vi.fn(),
      fetchPrCommentsList: vi.fn(),
      fetchPrReviewsList: vi.fn(),
      fetchPrDiffListFiles: vi.fn(),
      replyToReviewThread: vi.fn(),
      resolveReviewThread: vi.fn(),
      unresolveReviewThread: vi.fn()
    }

    const result = await runGraphqlCapability(
      client,
      "unsupported.capability" as unknown as Parameters<typeof runGraphqlCapability>[1],
      {}
    )

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.meta.reason).toBe("CAPABILITY_LIMIT")
  })
})

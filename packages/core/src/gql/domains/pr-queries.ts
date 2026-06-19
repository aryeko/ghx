import {
  assertPrCommentsReactionsListInput,
  assertPrDiffListFilesInput,
  assertPrInput,
  assertPrListInput,
  assertPrReactionsListInput,
  assertPrReviewsListInput,
} from "../assertions.js"
import { getSdk as getPrCommentsReactionsListSdk } from "../operations/pr-comments-reactions-list.generated.js"
import type { PrDiffListFilesQuery } from "../operations/pr-diff-list-files.generated.js"
import { getSdk as getPrDiffListFilesSdk } from "../operations/pr-diff-list-files.generated.js"
import type { PrListQuery, PullRequestState } from "../operations/pr-list.generated.js"
import { getSdk as getPrListSdk } from "../operations/pr-list.generated.js"
import { getSdk as getPrMergeStatusSdk } from "../operations/pr-merge-status.generated.js"
import { getSdk as getPrReactionsListSdk } from "../operations/pr-reactions-list.generated.js"
import type { PrReviewsListQuery } from "../operations/pr-reviews-list.generated.js"
import { getSdk as getPrReviewsListSdk } from "../operations/pr-reviews-list.generated.js"
import type { PrViewQuery } from "../operations/pr-view.generated.js"
import { getSdk as getPrViewSdk } from "../operations/pr-view.generated.js"
import type { GraphqlTransport } from "../transport.js"
import { createGraphqlRequestClient } from "../transport.js"
import type {
  PrCommentReactionSubjectData,
  PrCommentsReactionsListData,
  PrCommentsReactionsListInput,
  PrDiffListFilesData,
  PrDiffListFilesInput,
  PrListData,
  PrListInput,
  PrMergeStatusData,
  PrMergeStatusInput,
  PrReactionGroupData,
  PrReactionsListData,
  PrReactionsListInput,
  PrReviewsListData,
  PrReviewsListInput,
  PrViewData,
  PrViewInput,
} from "../types.js"

type ReactionFilter = {
  reactorLogin?: string
  content?: string
}

type RawReactor = { login?: string | null } | null

type RawReactionGroup = {
  content: string
  viewerHasReacted: boolean
  reactors: {
    totalCount: number
    nodes?: ReadonlyArray<RawReactor> | null
  }
}

type RawPrReactionsResult = {
  repository?: {
    pullRequest?: {
      id: string
      url: unknown
      reactionGroups?: ReadonlyArray<RawReactionGroup> | null
    } | null
  } | null
}

type RawCommentReactionSubject = {
  __typename: string
  id: string
  url: unknown
  author?: { login?: string | null } | null
  reactionGroups?: ReadonlyArray<RawReactionGroup> | null
}

type CommentsReactionCursor =
  | { v: 1; phase: "issue-comments"; after: string | null }
  | {
      v: 1
      phase: "review-threads"
      threadsAfter: string | null
      currentThread?: {
        id: string
        threadCursor: string | null
        commentsAfter: string | null
      }
    }

const PR_COMMENTS_REACTIONS_CURSOR_VERSION = 1
const MAX_PR_COMMENTS_REACTIONS_SCAN_PAGES = 5

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function encodeCommentsReactionCursor(cursor: CommentsReactionCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url")
}

function decodeCommentsReactionCursor(after: string | null | undefined): CommentsReactionCursor {
  if (after === undefined || after === null) {
    return { v: PR_COMMENTS_REACTIONS_CURSOR_VERSION, phase: "issue-comments", after: null }
  }

  try {
    const parsed = JSON.parse(Buffer.from(after, "base64url").toString("utf8")) as unknown
    const record = asRecord(parsed)
    if (!record || record.v !== PR_COMMENTS_REACTIONS_CURSOR_VERSION) {
      throw new Error("cursor version mismatch")
    }
    if (record.phase === "issue-comments") {
      const sourceAfter = record.after
      if (sourceAfter !== null && typeof sourceAfter !== "string") {
        throw new Error("invalid issue-comments cursor")
      }
      return {
        v: PR_COMMENTS_REACTIONS_CURSOR_VERSION,
        phase: "issue-comments",
        after: sourceAfter,
      }
    }
    if (record.phase === "review-threads") {
      const threadsAfter = record.threadsAfter
      if (threadsAfter !== null && typeof threadsAfter !== "string") {
        throw new Error("invalid review-threads cursor")
      }

      const currentThread = record.currentThread
      if (currentThread === undefined) {
        return {
          v: PR_COMMENTS_REACTIONS_CURSOR_VERSION,
          phase: "review-threads",
          threadsAfter,
        }
      }

      const thread = asRecord(currentThread)
      if (
        !thread ||
        typeof thread.id !== "string" ||
        (thread.threadCursor !== null && typeof thread.threadCursor !== "string") ||
        (thread.commentsAfter !== null && typeof thread.commentsAfter !== "string")
      ) {
        throw new Error("invalid current thread cursor")
      }

      return {
        v: PR_COMMENTS_REACTIONS_CURSOR_VERSION,
        phase: "review-threads",
        threadsAfter,
        currentThread: {
          id: thread.id,
          threadCursor: thread.threadCursor,
          commentsAfter: thread.commentsAfter,
        },
      }
    }
  } catch {
    throw new Error("Invalid after cursor")
  }

  throw new Error("Invalid after cursor")
}

function readEndCursor(pageInfo: { hasNextPage: boolean; endCursor?: string | null }): string {
  if (typeof pageInfo.endCursor !== "string" || pageInfo.endCursor.length === 0) {
    throw new Error("Pagination cursor missing from GitHub response")
  }
  return pageInfo.endCursor
}

function readReactorLogin(node: RawReactor): string | null {
  if (node === null || typeof node.login !== "string" || node.login.length === 0) {
    return null
  }
  return node.login
}

function mapReactionGroups(
  groups: ReadonlyArray<RawReactionGroup>,
  filter: ReactionFilter,
): PrReactionGroupData[] {
  return groups.flatMap((group) => {
    if (filter.content !== undefined && group.content !== filter.content) {
      return []
    }

    const collectedLogins = (group.reactors.nodes ?? []).flatMap((node) => {
      const login = readReactorLogin(node)
      return login !== null ? [login] : []
    })
    const totalCount = group.reactors.totalCount

    const reactorsTruncated = totalCount > collectedLogins.length

    if (filter.reactorLogin !== undefined) {
      const matched = collectedLogins.includes(filter.reactorLogin)
      // Only confidently drop the group when the login is absent AND every
      // reactor was fetched. When the reactor list is truncated, absence from
      // the first page is inconclusive — keep the group (with reactorsTruncated:
      // true) rather than returning a false "did not react".
      if (!matched && !reactorsTruncated) {
        return []
      }
      return [
        {
          content: group.content,
          reactorCount: totalCount,
          reactorLogins: matched ? [filter.reactorLogin] : [],
          viewerHasReacted: group.viewerHasReacted,
          reactorsTruncated,
        },
      ]
    }

    return [
      {
        content: group.content,
        reactorCount: totalCount,
        reactorLogins: collectedLogins,
        viewerHasReacted: group.viewerHasReacted,
        reactorsTruncated,
      },
    ]
  })
}

export function normalizePrReactionsListResult(
  result: unknown,
  input: PrReactionsListInput,
): PrReactionsListData {
  const pr = (result as RawPrReactionsResult).repository?.pullRequest
  if (!pr) {
    throw new Error("Pull request not found")
  }

  const filter: ReactionFilter = {
    ...(input.reactorLogin !== undefined ? { reactorLogin: input.reactorLogin } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
  }

  return {
    subject: { type: "PullRequest", id: pr.id, url: String(pr.url) },
    items: mapReactionGroups(pr.reactionGroups ?? [], filter),
    filterApplied: {
      reactorLogin: input.reactorLogin ?? null,
      content: input.content ?? null,
    },
  }
}

function mapCommentReactionSubject(
  node: RawCommentReactionSubject | null,
  filter: ReactionFilter,
): PrCommentReactionSubjectData[] {
  if (!node) {
    return []
  }

  const groups = mapReactionGroups(node.reactionGroups ?? [], filter)
  if (groups.length === 0) {
    return []
  }

  return [
    {
      subjectType: node.__typename,
      subjectId: node.id,
      subjectUrl: String(node.url),
      authorLogin: node.author?.login ?? null,
      groups,
    },
  ]
}

function normalizePrListStates(state: string | null | undefined): PullRequestState[] | undefined {
  if (state === undefined || state === null) {
    return undefined
  }

  const normalized = state.trim().toUpperCase()
  if (!normalized || normalized === "ALL") {
    return undefined
  }
  if (normalized !== "OPEN" && normalized !== "CLOSED" && normalized !== "MERGED") {
    throw new Error("Invalid state for pr.list")
  }

  return [normalized]
}

export async function runPrView(
  transport: GraphqlTransport,
  input: PrViewInput,
): Promise<PrViewData> {
  assertPrInput(input)

  const sdk = getPrViewSdk(createGraphqlRequestClient(transport))
  const result: PrViewQuery = await sdk.PrView({
    owner: input.owner,
    name: input.name,
    prNumber: input.prNumber,
  })
  const pr = result.repository?.pullRequest
  if (!pr) {
    throw new Error("Pull request not found")
  }

  const excludeBody = Array.isArray(input.exclude) && input.exclude.includes("body")

  const base: PrViewData = {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    url: pr.url,
    labels: (pr.labels?.nodes ?? []).flatMap((n) => (n ? [n.name] : [])),
  }

  if (excludeBody) {
    return base
  }

  return { ...base, body: pr.body ?? "" }
}

export async function runPrList(
  transport: GraphqlTransport,
  input: PrListInput,
): Promise<PrListData> {
  assertPrListInput(input)

  const sdk = getPrListSdk(createGraphqlRequestClient(transport))
  const result: PrListQuery = await sdk.PrList({
    owner: input.owner,
    name: input.name,
    first: input.first,
    after: input.after,
    states: normalizePrListStates(input.state),
  })
  const prs = result.repository?.pullRequests
  if (!prs) {
    throw new Error("Pull requests not found")
  }

  return {
    items: (prs.nodes ?? []).flatMap((pr) =>
      pr
        ? [
            {
              id: pr.id,
              number: pr.number,
              title: pr.title,
              state: pr.state,
              url: pr.url,
            },
          ]
        : [],
    ),
    pageInfo: {
      endCursor: prs.pageInfo.endCursor ?? null,
      hasNextPage: prs.pageInfo.hasNextPage,
    },
  }
}

export async function runPrReviewsList(
  transport: GraphqlTransport,
  input: PrReviewsListInput,
): Promise<PrReviewsListData> {
  assertPrReviewsListInput(input)

  const sdk = getPrReviewsListSdk(createGraphqlRequestClient(transport))
  const result: PrReviewsListQuery = await sdk.PrReviewsList(input)
  const reviews = result.repository?.pullRequest?.reviews
  if (!reviews) {
    throw new Error("Pull request reviews not found")
  }

  return {
    items: (reviews.nodes ?? []).flatMap((review) =>
      review
        ? [
            {
              id: review.id,
              authorLogin: review.author?.login ?? null,
              body: review.body,
              state: review.state,
              submittedAt: review.submittedAt ?? null,
              url: review.url,
              commitOid: review.commit?.oid ?? null,
            },
          ]
        : [],
    ),
    pageInfo: {
      endCursor: reviews.pageInfo.endCursor ?? null,
      hasNextPage: reviews.pageInfo.hasNextPage,
    },
  }
}

export async function runPrReactionsList(
  transport: GraphqlTransport,
  input: PrReactionsListInput,
): Promise<PrReactionsListData> {
  assertPrReactionsListInput(input)

  const sdk = getPrReactionsListSdk(createGraphqlRequestClient(transport))
  const result = await sdk.PrReactionsList({
    owner: input.owner,
    name: input.name,
    prNumber: input.prNumber,
  })
  return normalizePrReactionsListResult(result, input)
}

export async function runPrCommentsReactionsList(
  transport: GraphqlTransport,
  input: PrCommentsReactionsListInput,
): Promise<PrCommentsReactionsListData> {
  assertPrCommentsReactionsListInput(input)

  const sdk = getPrCommentsReactionsListSdk(createGraphqlRequestClient(transport))
  const first = input.first ?? 30
  let cursor = decodeCommentsReactionCursor(input.after)
  const filter: ReactionFilter = {
    ...(input.reactorLogin !== undefined ? { reactorLogin: input.reactorLogin } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
  }

  const items: PrCommentReactionSubjectData[] = []
  let pagesScanned = 0
  let sourceItemsScanned = 0
  let nextCursor: CommentsReactionCursor | null = cursor

  while (
    cursor.phase === "issue-comments" &&
    items.length < first &&
    pagesScanned < MAX_PR_COMMENTS_REACTIONS_SCAN_PAGES
  ) {
    const result = await sdk.PrCommentsReactionsIssueCommentsPage({
      owner: input.owner,
      name: input.name,
      prNumber: input.prNumber,
      first: first - items.length,
      after: cursor.after,
    })
    const pr = result.repository?.pullRequest
    if (!pr) {
      throw new Error("Pull request not found")
    }

    pagesScanned += 1
    const nodes = pr.comments.nodes ?? []
    sourceItemsScanned += nodes.length
    for (const node of nodes) {
      if (items.length >= first) {
        break
      }
      items.push(...mapCommentReactionSubject(node, filter))
    }

    if (pr.comments.pageInfo.hasNextPage) {
      const after = readEndCursor(pr.comments.pageInfo)
      cursor = { v: PR_COMMENTS_REACTIONS_CURSOR_VERSION, phase: "issue-comments", after }
      nextCursor = cursor
    } else {
      cursor = {
        v: PR_COMMENTS_REACTIONS_CURSOR_VERSION,
        phase: "review-threads",
        threadsAfter: null,
      }
      nextCursor = cursor
    }
  }

  while (
    cursor.phase === "review-threads" &&
    items.length < first &&
    pagesScanned < MAX_PR_COMMENTS_REACTIONS_SCAN_PAGES
  ) {
    if (cursor.currentThread) {
      const threadResult = await sdk.PrCommentsReactionsThreadCommentsPage({
        threadId: cursor.currentThread.id,
        first: first - items.length,
        after: cursor.currentThread.commentsAfter,
      })
      const thread = threadResult.node
      if (!thread || thread.__typename !== "PullRequestReviewThread") {
        throw new Error("Pull request review thread not found")
      }

      pagesScanned += 1
      const nodes = thread.comments.nodes ?? []
      sourceItemsScanned += nodes.length
      for (const node of nodes) {
        if (items.length >= first) {
          break
        }
        items.push(...mapCommentReactionSubject(node, filter))
      }

      if (thread.comments.pageInfo.hasNextPage) {
        cursor = {
          v: PR_COMMENTS_REACTIONS_CURSOR_VERSION,
          phase: "review-threads",
          threadsAfter: cursor.threadsAfter,
          currentThread: {
            id: cursor.currentThread.id,
            threadCursor: cursor.currentThread.threadCursor,
            commentsAfter: readEndCursor(thread.comments.pageInfo),
          },
        }
        nextCursor = cursor
      } else {
        cursor = {
          v: PR_COMMENTS_REACTIONS_CURSOR_VERSION,
          phase: "review-threads",
          threadsAfter: cursor.currentThread.threadCursor,
        }
        nextCursor = cursor
      }
      continue
    }

    const result = await sdk.PrCommentsReactionsReviewThreadsPage({
      owner: input.owner,
      name: input.name,
      prNumber: input.prNumber,
      first: Math.max(1, first - items.length),
      after: cursor.threadsAfter,
    })
    const pr = result.repository?.pullRequest
    if (!pr) {
      throw new Error("Pull request not found")
    }

    pagesScanned += 1
    const edges = pr.reviewThreads.edges ?? []
    for (const edge of edges) {
      if (!edge?.node) {
        continue
      }
      const thread = edge.node
      const threadCursor = typeof edge.cursor === "string" ? edge.cursor : null
      const nodes = thread.comments.nodes ?? []
      sourceItemsScanned += nodes.length

      for (const node of nodes) {
        if (items.length >= first) {
          break
        }
        items.push(...mapCommentReactionSubject(node, filter))
      }

      if (thread.comments.pageInfo.hasNextPage) {
        cursor = {
          v: PR_COMMENTS_REACTIONS_CURSOR_VERSION,
          phase: "review-threads",
          threadsAfter: cursor.threadsAfter,
          currentThread: {
            id: thread.id,
            threadCursor,
            commentsAfter: readEndCursor(thread.comments.pageInfo),
          },
        }
        nextCursor = cursor
        break
      }

      cursor = {
        v: PR_COMMENTS_REACTIONS_CURSOR_VERSION,
        phase: "review-threads",
        threadsAfter: threadCursor,
      }
      nextCursor = cursor

      if (items.length >= first) {
        break
      }
    }

    if (items.length >= first || cursor.currentThread) {
      continue
    }

    if (pr.reviewThreads.pageInfo.hasNextPage) {
      cursor = {
        v: PR_COMMENTS_REACTIONS_CURSOR_VERSION,
        phase: "review-threads",
        threadsAfter: readEndCursor(pr.reviewThreads.pageInfo),
      }
      nextCursor = cursor
    } else {
      nextCursor = null
      break
    }
  }

  const scanTruncated =
    nextCursor !== null &&
    pagesScanned >= MAX_PR_COMMENTS_REACTIONS_SCAN_PAGES &&
    items.length < first

  return {
    items,
    filterApplied: {
      reactorLogin: input.reactorLogin ?? null,
      content: input.content ?? null,
    },
    pageInfo: {
      hasNextPage: nextCursor !== null,
      endCursor: nextCursor !== null ? encodeCommentsReactionCursor(nextCursor) : null,
    },
    scan: {
      pagesScanned,
      sourceItemsScanned,
      scanTruncated,
    },
  }
}

export async function runPrDiffListFiles(
  transport: GraphqlTransport,
  input: PrDiffListFilesInput,
): Promise<PrDiffListFilesData> {
  assertPrDiffListFilesInput(input)

  const sdk = getPrDiffListFilesSdk(createGraphqlRequestClient(transport))
  const result: PrDiffListFilesQuery = await sdk.PrDiffListFiles(input)
  const files = result.repository?.pullRequest?.files
  if (!files) {
    throw new Error("Pull request files not found")
  }

  return {
    items: (files.nodes ?? []).flatMap((file) =>
      file
        ? [
            {
              path: file.path,
              additions: file.additions,
              deletions: file.deletions,
            },
          ]
        : [],
    ),
    pageInfo: {
      endCursor: files.pageInfo.endCursor ?? null,
      hasNextPage: files.pageInfo.hasNextPage,
    },
  }
}

export async function runPrMergeStatus(
  transport: GraphqlTransport,
  input: PrMergeStatusInput,
): Promise<PrMergeStatusData> {
  assertPrInput({ owner: input.owner, name: input.name, prNumber: input.prNumber })

  const result = await getPrMergeStatusSdk(createGraphqlRequestClient(transport)).PrMergeStatus({
    owner: input.owner,
    name: input.name,
    prNumber: input.prNumber,
  })

  const pr = result.repository?.pullRequest
  if (!pr) {
    throw new Error("Pull request not found")
  }

  return {
    mergeable: pr.mergeable ?? null,
    mergeStateStatus: pr.mergeStateStatus ?? null,
    reviewDecision: pr.reviewDecision ?? null,
    isDraft: pr.isDraft,
    state: pr.state,
  }
}

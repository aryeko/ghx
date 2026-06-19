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
import type { PrListQuery } from "../operations/pr-list.generated.js"
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

type RawCommentReactionNode = {
  __typename: string
  id: string
  url: unknown
  author?: { login?: string | null } | null
  reactionGroups?: ReadonlyArray<RawReactionGroup> | null
}

type RawPrCommentsReactionsResult = {
  repository?: {
    pullRequest?: {
      comments: {
        pageInfo: { hasNextPage: boolean }
        nodes?: ReadonlyArray<RawCommentReactionNode | null> | null
      }
      reviewThreads: {
        pageInfo: { hasNextPage: boolean }
        nodes?: ReadonlyArray<{
          comments: {
            pageInfo: { hasNextPage: boolean }
            nodes?: ReadonlyArray<RawCommentReactionNode | null> | null
          }
        } | null> | null
      }
    } | null
  } | null
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

export function normalizePrCommentsReactionsListResult(
  result: unknown,
  input: PrCommentsReactionsListInput,
): PrCommentsReactionsListData {
  const pr = (result as RawPrCommentsReactionsResult).repository?.pullRequest
  if (!pr) {
    throw new Error("Pull request not found")
  }

  const filter: ReactionFilter = {
    ...(input.reactorLogin !== undefined ? { reactorLogin: input.reactorLogin } : {}),
    ...(input.content !== undefined ? { content: input.content } : {}),
  }

  const issueCommentItems: PrCommentReactionSubjectData[] = (pr.comments.nodes ?? []).flatMap(
    (node) => {
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
    },
  )

  let threadCommentsTruncated = false
  const reviewCommentItems: PrCommentReactionSubjectData[] = (pr.reviewThreads.nodes ?? []).flatMap(
    (thread) => {
      if (!thread) {
        return []
      }
      if (thread.comments.pageInfo.hasNextPage) {
        threadCommentsTruncated = true
      }
      return (thread.comments.nodes ?? []).flatMap((node) => {
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
      })
    },
  )

  return {
    items: [...issueCommentItems, ...reviewCommentItems],
    filterApplied: {
      reactorLogin: input.reactorLogin ?? null,
      content: input.content ?? null,
    },
    scan: {
      commentsTruncated: pr.comments.pageInfo.hasNextPage,
      threadsTruncated: pr.reviewThreads.pageInfo.hasNextPage,
      threadCommentsTruncated,
    },
  }
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
  const result: PrListQuery = await sdk.PrList(input)
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
  const result = await sdk.PrCommentsReactionsList({
    owner: input.owner,
    name: input.name,
    prNumber: input.prNumber,
    commentsFirst: input.commentsFirst ?? 30,
    threadsFirst: input.threadsFirst ?? 30,
    threadCommentsFirst: input.threadCommentsFirst ?? 30,
  })
  return normalizePrCommentsReactionsListResult(result, input)
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

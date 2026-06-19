/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never }

import { type GraphQLClient, type RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"
import { TypedDocumentString } from "./typed-document-string.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
/** Detailed status information about a pull request merge. */
export type MergeStateStatus =
  /** The head ref is out of date. */
  | "BEHIND"
  /** The merge is blocked. */
  | "BLOCKED"
  /** Mergeable and passing commit status. */
  | "CLEAN"
  /** The merge commit cannot be cleanly created. */
  | "DIRTY"
  /** The merge is blocked due to the pull request being a draft. */
  | "DRAFT"
  /** Mergeable with passing commit status and pre-receive hooks. */
  | "HAS_HOOKS"
  /** The state cannot currently be determined. */
  | "UNKNOWN"
  /** Mergeable with non-passing commit status. */
  | "UNSTABLE"

/** Whether or not a PullRequest can be merged. */
export type MergeableState =
  /** The pull request cannot be merged due to merge conflicts. */
  | "CONFLICTING"
  /** The pull request can be merged. */
  | "MERGEABLE"
  /** The mergeability of the pull request is still being calculated. */
  | "UNKNOWN"

/** The review status of a pull request. */
export type PullRequestReviewDecision =
  /** The pull request has received an approving review. */
  | "APPROVED"
  /** Changes have been requested on the pull request. */
  | "CHANGES_REQUESTED"
  /** A review is required before the pull request can be merged. */
  | "REVIEW_REQUIRED"

/** The possible states of a pull request. */
export type PullRequestState =
  /** A pull request that has been closed without being merged. */
  | "CLOSED"
  /** A pull request that has been closed by being merged. */
  | "MERGED"
  /** A pull request that is still open. */
  | "OPEN"

export type PrMergeStatusQueryVariables = Exact<{
  owner: string
  name: string
  prNumber: number
}>

export type PrMergeStatusQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    pullRequest: {
      __typename: "PullRequest"
      mergeable: Types.MergeableState
      mergeStateStatus: Types.MergeStateStatus
      reviewDecision: Types.PullRequestReviewDecision | null
      isDraft: boolean
      state: Types.PullRequestState
    } | null
  } | null
}

export const PrMergeStatusDocument = new TypedDocumentString(`
    query PrMergeStatus($owner: String!, $name: String!, $prNumber: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $prNumber) {
      mergeable
      mergeStateStatus
      reviewDecision
      isDraft
      state
    }
  }
}
    `)

export type SdkFunctionWrapper = <T>(
  action: (requestHeaders?: Record<string, string>) => Promise<T>,
  operationName: string,
  operationType?: string,
  variables?: any,
) => Promise<T>

const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) =>
  action()

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    PrMergeStatus(
      variables: PrMergeStatusQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrMergeStatusQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrMergeStatusQuery>({
            document: PrMergeStatusDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrMergeStatus",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

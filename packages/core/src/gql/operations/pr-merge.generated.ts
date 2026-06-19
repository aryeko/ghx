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
/** Represents available types of methods to use when merging a pull request. */
export type PullRequestMergeMethod =
  /** Add all commits from the head branch to the base branch with a merge commit. */
  | "MERGE"
  /** Add all commits from the head branch onto the base branch individually. */
  | "REBASE"
  /** Combine all commits from the head branch into a single commit in the base branch. */
  | "SQUASH"

/** The possible states of a pull request. */
export type PullRequestState =
  /** A pull request that has been closed without being merged. */
  | "CLOSED"
  /** A pull request that has been closed by being merged. */
  | "MERGED"
  /** A pull request that is still open. */
  | "OPEN"

export type PrMergeMutationVariables = Exact<{
  pullRequestId: string | number
  mergeMethod?: Types.PullRequestMergeMethod | null | undefined
}>

export type PrMergeMutation = {
  __typename: "Mutation"
  mergePullRequest: {
    __typename: "MergePullRequestPayload"
    pullRequest: {
      __typename: "PullRequest"
      id: string
      number: number
      state: Types.PullRequestState
      merged: boolean
      mergedAt: any
    } | null
  } | null
}

export const PrMergeDocument = new TypedDocumentString(`
    mutation PrMerge($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod) {
  __typename
  mergePullRequest(
    input: {pullRequestId: $pullRequestId, mergeMethod: $mergeMethod}
  ) {
    __typename
    pullRequest {
      __typename
      id
      number
      state
      merged
      mergedAt
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
    PrMerge(
      variables: PrMergeMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrMergeMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrMergeMutation>({
            document: PrMergeDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrMerge",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

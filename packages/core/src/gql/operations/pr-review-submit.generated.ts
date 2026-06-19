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
/** The possible sides of a diff. */
export type DiffSide =
  /** The left side of the diff. */
  | "LEFT"
  /** The right side of the diff. */
  | "RIGHT"

/** Specifies a review comment thread to be left with a Pull Request Review. */
export type DraftPullRequestReviewThread = {
  /** Body of the comment to leave. */
  body: string
  /** The line of the blob to which the thread refers. The end of the line range for multi-line comments. Required if not using positioning. */
  line?: number | null | undefined
  /** Path to the file being commented on. Required if not using positioning. */
  path?: string | null | undefined
  /** The side of the diff on which the line resides. For multi-line comments, this is the side for the end of the line range. */
  side?: DiffSide | null | undefined
  /** The first line of the range to which the comment refers. */
  startLine?: number | null | undefined
  /** The side of the diff on which the start line resides. */
  startSide?: DiffSide | null | undefined
}

/** The possible events to perform on a pull request review. */
export type PullRequestReviewEvent =
  /** Submit feedback and approve merging these changes. */
  | "APPROVE"
  /** Submit general feedback without explicit approval. */
  | "COMMENT"
  /** Dismiss review so it now longer effects merging. */
  | "DISMISS"
  /** Submit feedback that must be addressed before merging. */
  | "REQUEST_CHANGES"

/** The possible states of a pull request review. */
export type PullRequestReviewState =
  /** A review allowing the pull request to merge. */
  | "APPROVED"
  /** A review blocking the pull request from merging. */
  | "CHANGES_REQUESTED"
  /** An informational review. */
  | "COMMENTED"
  /** A review that has been dismissed. */
  | "DISMISSED"
  /** A review that has not yet been submitted. */
  | "PENDING"

export type PrReviewSubmitMutationVariables = Exact<{
  pullRequestId: string | number
  event: Types.PullRequestReviewEvent
  body?: string | null | undefined
  threads?:
    | Array<Types.DraftPullRequestReviewThread>
    | Types.DraftPullRequestReviewThread
    | null
    | undefined
}>

export type PrReviewSubmitMutation = {
  __typename: "Mutation"
  addPullRequestReview: {
    __typename: "AddPullRequestReviewPayload"
    pullRequestReview: {
      __typename: "PullRequestReview"
      id: string
      state: Types.PullRequestReviewState
      url: any
      body: string
    } | null
  } | null
}

export const PrReviewSubmitDocument = new TypedDocumentString(`
    mutation PrReviewSubmit($pullRequestId: ID!, $event: PullRequestReviewEvent!, $body: String, $threads: [DraftPullRequestReviewThread!]) {
  __typename
  addPullRequestReview(
    input: {pullRequestId: $pullRequestId, event: $event, body: $body, threads: $threads}
  ) {
    __typename
    pullRequestReview {
      __typename
      id
      state
      url
      body
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
    PrReviewSubmit(
      variables: PrReviewSubmitMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrReviewSubmitMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrReviewSubmitMutation>({
            document: PrReviewSubmitDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrReviewSubmit",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

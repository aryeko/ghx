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
/** The possible states of a pull request. */
export type PullRequestState =
  /** A pull request that has been closed without being merged. */
  | "CLOSED"
  /** A pull request that has been closed by being merged. */
  | "MERGED"
  /** A pull request that is still open. */
  | "OPEN"

export type PrCloseMutationVariables = Exact<{
  pullRequestId: string | number
  addComment?: boolean
  commentBody?: string
}>

export type PrCloseMutation = {
  __typename: "Mutation"
  closePullRequest: {
    __typename: "ClosePullRequestPayload"
    pullRequest: {
      __typename: "PullRequest"
      id: string
      number: number
      state: Types.PullRequestState
      closed: boolean
    } | null
  } | null
  addComment?: {
    __typename: "AddCommentPayload"
    commentEdge: {
      __typename: "IssueCommentEdge"
      node: { __typename: "IssueComment"; id: string } | null
    } | null
  } | null
}

export const PrCloseDocument = new TypedDocumentString(`
    mutation PrClose($pullRequestId: ID!, $addComment: Boolean! = false, $commentBody: String! = "") {
  closePullRequest(input: {pullRequestId: $pullRequestId}) {
    pullRequest {
      id
      number
      state
      closed
    }
  }
  addComment(input: {subjectId: $pullRequestId, body: $commentBody}) @include(if: $addComment) {
    commentEdge {
      node {
        id
      }
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
    PrClose(
      variables: PrCloseMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrCloseMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrCloseMutation>({
            document: PrCloseDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrClose",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

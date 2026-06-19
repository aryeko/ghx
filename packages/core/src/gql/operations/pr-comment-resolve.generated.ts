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
export type PrCommentResolveMutationVariables = Exact<{
  threadId: string | number
}>

export type PrCommentResolveMutation = {
  __typename: "Mutation"
  resolveReviewThread: {
    __typename: "ResolveReviewThreadPayload"
    thread: { __typename: "PullRequestReviewThread"; id: string; isResolved: boolean } | null
  } | null
}

export const PrCommentResolveDocument = new TypedDocumentString(`
    mutation PrCommentResolve($threadId: ID!) {
  __typename
  resolveReviewThread(input: {threadId: $threadId}) {
    __typename
    thread {
      __typename
      id
      isResolved
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
    PrCommentResolve(
      variables: PrCommentResolveMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrCommentResolveMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrCommentResolveMutation>({
            document: PrCommentResolveDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrCommentResolve",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

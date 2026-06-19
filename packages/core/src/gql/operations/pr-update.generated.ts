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

export type PrUpdateMutationVariables = Exact<{
  pullRequestId: string | number
  title?: string | null | undefined
  body?: string | null | undefined
}>

export type PrUpdateMutation = {
  __typename: "Mutation"
  updatePullRequest: {
    __typename: "UpdatePullRequestPayload"
    pullRequest: {
      __typename: "PullRequest"
      id: string
      number: number
      title: string
      state: Types.PullRequestState
      url: any
      isDraft: boolean
    } | null
  } | null
}

export const PrUpdateDocument = new TypedDocumentString(`
    mutation PrUpdate($pullRequestId: ID!, $title: String, $body: String) {
  updatePullRequest(
    input: {pullRequestId: $pullRequestId, title: $title, body: $body}
  ) {
    pullRequest {
      id
      number
      title
      state
      url
      isDraft
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
    PrUpdate(
      variables: PrUpdateMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrUpdateMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrUpdateMutation>({
            document: PrUpdateDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrUpdate",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

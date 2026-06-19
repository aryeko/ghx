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

export type PrCreateMutationVariables = Exact<{
  repositoryId: string | number
  baseRefName: string
  headRefName: string
  title: string
  body?: string | null | undefined
  draft?: boolean | null | undefined
}>

export type PrCreateMutation = {
  __typename: "Mutation"
  createPullRequest: {
    __typename: "CreatePullRequestPayload"
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

export const PrCreateDocument = new TypedDocumentString(`
    mutation PrCreate($repositoryId: ID!, $baseRefName: String!, $headRefName: String!, $title: String!, $body: String, $draft: Boolean) {
  createPullRequest(
    input: {repositoryId: $repositoryId, baseRefName: $baseRefName, headRefName: $headRefName, title: $title, body: $body, draft: $draft}
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
    PrCreate(
      variables: PrCreateMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrCreateMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrCreateMutation>({
            document: PrCreateDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrCreate",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

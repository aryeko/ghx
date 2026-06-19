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

export type PrListQueryVariables = Exact<{
  owner: string
  name: string
  first: number
  after?: string | null | undefined
}>

export type PrListQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    pullRequests: {
      __typename: "PullRequestConnection"
      nodes: Array<{
        __typename: "PullRequest"
        id: string
        number: number
        title: string
        state: Types.PullRequestState
        url: any
      } | null> | null
      pageInfo: { __typename: "PageInfo"; endCursor: string | null; hasNextPage: boolean }
    }
  } | null
}

export const PrListDocument = new TypedDocumentString(`
    query PrList($owner: String!, $name: String!, $first: Int!, $after: String) {
  __typename
  repository(owner: $owner, name: $name) {
    __typename
    pullRequests(
      first: $first
      after: $after
      orderBy: {field: CREATED_AT, direction: DESC}
    ) {
      __typename
      nodes {
        __typename
        ...PrCoreFields
      }
      pageInfo {
        __typename
        ...PageInfoFields
      }
    }
  }
}
    fragment PrCoreFields on PullRequest {
  id
  number
  title
  state
  url
}
fragment PageInfoFields on PageInfo {
  endCursor
  hasNextPage
}`)

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
    PrList(
      variables: PrListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrListQuery>({
            document: PrListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

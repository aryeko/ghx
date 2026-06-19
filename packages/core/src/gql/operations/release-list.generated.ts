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
export type ReleaseListQueryVariables = Exact<{
  owner: string
  name: string
  first: number
  after?: string | null | undefined
}>

export type ReleaseListQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    releases: {
      __typename: "ReleaseConnection"
      nodes: Array<{
        __typename: "Release"
        databaseId: number | null
        tagName: string
        name: string | null
        isDraft: boolean
        isPrerelease: boolean
        url: any
        createdAt: any
        publishedAt: any
        tagCommit: { __typename: "Commit"; oid: any } | null
      } | null> | null
      pageInfo: { __typename: "PageInfo"; endCursor: string | null; hasNextPage: boolean }
    }
  } | null
}

export const ReleaseListDocument = new TypedDocumentString(`
    query ReleaseList($owner: String!, $name: String!, $first: Int!, $after: String) {
  __typename
  repository(owner: $owner, name: $name) {
    __typename
    releases(
      first: $first
      after: $after
      orderBy: {field: CREATED_AT, direction: DESC}
    ) {
      __typename
      nodes {
        __typename
        databaseId
        tagName
        name
        isDraft
        isPrerelease
        url
        tagCommit {
          __typename
          oid
        }
        createdAt
        publishedAt
      }
      pageInfo {
        __typename
        ...PageInfoFields
      }
    }
  }
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
    ReleaseList(
      variables: ReleaseListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ReleaseListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ReleaseListQuery>({
            document: ReleaseListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ReleaseList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

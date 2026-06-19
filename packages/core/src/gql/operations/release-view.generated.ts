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
export type ReleaseViewQueryVariables = Exact<{
  owner: string
  name: string
  tagName: string
}>

export type ReleaseViewQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    release: {
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
    } | null
  } | null
}

export const ReleaseViewDocument = new TypedDocumentString(`
    query ReleaseView($owner: String!, $name: String!, $tagName: String!) {
  __typename
  repository(owner: $owner, name: $name) {
    __typename
    release(tagName: $tagName) {
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
    ReleaseView(
      variables: ReleaseViewQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ReleaseViewQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ReleaseViewQuery>({
            document: ReleaseViewDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ReleaseView",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

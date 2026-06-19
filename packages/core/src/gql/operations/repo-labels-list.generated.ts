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
export type RepoLabelsListQueryVariables = Exact<{
  owner: string
  name: string
  first: number
  after?: string | null | undefined
}>

export type RepoLabelsListQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    labels: {
      __typename: "LabelConnection"
      nodes: Array<{
        __typename: "Label"
        id: string
        name: string
        description: string | null
        color: string
        isDefault: boolean
      } | null> | null
      pageInfo: { __typename: "PageInfo"; endCursor: string | null; hasNextPage: boolean }
    } | null
  } | null
}

export const RepoLabelsListDocument = new TypedDocumentString(`
    query RepoLabelsList($owner: String!, $name: String!, $first: Int!, $after: String) {
  __typename
  repository(owner: $owner, name: $name) {
    __typename
    labels(
      first: $first
      after: $after
      orderBy: {field: CREATED_AT, direction: DESC}
    ) {
      __typename
      nodes {
        __typename
        id
        name
        description
        color
        isDefault
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
    RepoLabelsList(
      variables: RepoLabelsListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<RepoLabelsListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<RepoLabelsListQuery>({
            document: RepoLabelsListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "RepoLabelsList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

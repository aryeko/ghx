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
/** The possible color for an issue type */
export type IssueTypeColor =
  /** blue */
  | "BLUE"
  /** gray */
  | "GRAY"
  /** green */
  | "GREEN"
  /** orange */
  | "ORANGE"
  /** pink */
  | "PINK"
  /** purple */
  | "PURPLE"
  /** red */
  | "RED"
  /** yellow */
  | "YELLOW"

export type RepoIssueTypesListQueryVariables = Exact<{
  owner: string
  name: string
  first: number
  after?: string | null | undefined
}>

export type RepoIssueTypesListQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    issueTypes: {
      __typename: "IssueTypeConnection"
      nodes: Array<{
        __typename: "IssueType"
        id: string
        name: string
        color: Types.IssueTypeColor
        isEnabled: boolean
      } | null> | null
      pageInfo: { __typename: "PageInfo"; endCursor: string | null; hasNextPage: boolean }
    } | null
  } | null
}

export const RepoIssueTypesListDocument = new TypedDocumentString(`
    query RepoIssueTypesList($owner: String!, $name: String!, $first: Int!, $after: String) {
  __typename
  repository(owner: $owner, name: $name) {
    __typename
    issueTypes(first: $first, after: $after) {
      __typename
      nodes {
        __typename
        id
        name
        color
        isEnabled
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
    RepoIssueTypesList(
      variables: RepoIssueTypesListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<RepoIssueTypesListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<RepoIssueTypesListQuery>({
            document: RepoIssueTypesListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "RepoIssueTypesList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

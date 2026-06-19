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
/** The possible states of an issue. */
export type IssueState =
  /** An issue that has been closed */
  | "CLOSED"
  /** An issue that is still open */
  | "OPEN"

export type IssueListQueryVariables = Exact<{
  owner: string
  name: string
  first: number
  after?: string | null | undefined
  states?: Array<Types.IssueState> | Types.IssueState | null | undefined
}>

export type IssueListQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    issues: {
      __typename: "IssueConnection"
      nodes: Array<{
        __typename: "Issue"
        id: string
        number: number
        title: string
        state: Types.IssueState
        url: any
      } | null> | null
      pageInfo: { __typename: "PageInfo"; endCursor: string | null; hasNextPage: boolean }
    }
  } | null
}

export const IssueListDocument = new TypedDocumentString(`
    query IssueList($owner: String!, $name: String!, $first: Int!, $after: String, $states: [IssueState!]) {
  __typename
  repository(owner: $owner, name: $name) {
    __typename
    issues(
      first: $first
      after: $after
      states: $states
      orderBy: {field: CREATED_AT, direction: DESC}
    ) {
      __typename
      nodes {
        __typename
        ...IssueCoreFields
      }
      pageInfo {
        __typename
        ...PageInfoFields
      }
    }
  }
}
    fragment IssueCoreFields on Issue {
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
    IssueList(
      variables: IssueListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueListQuery>({
            document: IssueListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

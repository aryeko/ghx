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
export type IssueAssigneesLookupByNumberQueryVariables = Exact<{
  owner: string
  name: string
  issueNumber: number
  assignableUsersAfter?: string | null | undefined
}>

export type IssueAssigneesLookupByNumberQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    issue: { __typename: "Issue"; id: string } | null
    assignableUsers: {
      __typename: "UserConnection"
      pageInfo: { __typename: "PageInfo"; hasNextPage: boolean; endCursor: string | null }
      nodes: Array<{ __typename: "User"; id: string; login: string } | null> | null
    }
  } | null
}

export const IssueAssigneesLookupByNumberDocument = new TypedDocumentString(`
    query IssueAssigneesLookupByNumber($owner: String!, $name: String!, $issueNumber: Int!, $assignableUsersAfter: String) {
  __typename
  repository(owner: $owner, name: $name) {
    __typename
    issue(number: $issueNumber) {
      __typename
      id
    }
    assignableUsers(first: 100, after: $assignableUsersAfter) {
      __typename
      pageInfo {
        __typename
        hasNextPage
        endCursor
      }
      nodes {
        __typename
        id
        login
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
    IssueAssigneesLookupByNumber(
      variables: IssueAssigneesLookupByNumberQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueAssigneesLookupByNumberQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueAssigneesLookupByNumberQuery>({
            document: IssueAssigneesLookupByNumberDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueAssigneesLookupByNumber",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

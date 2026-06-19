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
export type IssueLabelsLookupByNumberQueryVariables = Exact<{
  owner: string
  name: string
  issueNumber: number
}>

export type IssueLabelsLookupByNumberQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    issue: { __typename: "Issue"; id: string } | null
    labels: {
      __typename: "LabelConnection"
      pageInfo: { __typename: "PageInfo"; hasNextPage: boolean; endCursor: string | null }
      nodes: Array<{ __typename: "Label"; id: string; name: string } | null> | null
    } | null
  } | null
}

export const IssueLabelsLookupByNumberDocument = new TypedDocumentString(`
    query IssueLabelsLookupByNumber($owner: String!, $name: String!, $issueNumber: Int!) {
  __typename
  repository(owner: $owner, name: $name) {
    __typename
    issue(number: $issueNumber) {
      __typename
      id
    }
    labels(first: 100) {
      __typename
      pageInfo {
        __typename
        hasNextPage
        endCursor
      }
      nodes {
        __typename
        id
        name
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
    IssueLabelsLookupByNumber(
      variables: IssueLabelsLookupByNumberQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueLabelsLookupByNumberQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueLabelsLookupByNumberQuery>({
            document: IssueLabelsLookupByNumberDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueLabelsLookupByNumber",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

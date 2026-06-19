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
export type IssueNodeIdLookupQueryVariables = Exact<{
  owner: string
  name: string
  issueNumber: number
}>

export type IssueNodeIdLookupQuery = {
  __typename: "Query"
  repository: { __typename: "Repository"; issue: { __typename: "Issue"; id: string } | null } | null
}

export const IssueNodeIdLookupDocument = new TypedDocumentString(`
    query IssueNodeIdLookup($owner: String!, $name: String!, $issueNumber: Int!) {
  __typename
  repository(owner: $owner, name: $name) {
    __typename
    issue(number: $issueNumber) {
      __typename
      id
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
    IssueNodeIdLookup(
      variables: IssueNodeIdLookupQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueNodeIdLookupQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueNodeIdLookupQuery>({
            document: IssueNodeIdLookupDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueNodeIdLookup",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

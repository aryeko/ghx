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
export type IssueMilestoneLookupByNumberQueryVariables = Exact<{
  owner: string
  name: string
  issueNumber: number
  milestoneNumber: number
}>

export type IssueMilestoneLookupByNumberQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    issue: { __typename: "Issue"; id: string } | null
    milestone: { __typename: "Milestone"; id: string } | null
  } | null
}

export const IssueMilestoneLookupByNumberDocument = new TypedDocumentString(`
    query IssueMilestoneLookupByNumber($owner: String!, $name: String!, $issueNumber: Int!, $milestoneNumber: Int!) {
  __typename
  repository(owner: $owner, name: $name) {
    __typename
    issue(number: $issueNumber) {
      __typename
      id
    }
    milestone(number: $milestoneNumber) {
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
    IssueMilestoneLookupByNumber(
      variables: IssueMilestoneLookupByNumberQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueMilestoneLookupByNumberQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueMilestoneLookupByNumberQuery>({
            document: IssueMilestoneLookupByNumberDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueMilestoneLookupByNumber",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

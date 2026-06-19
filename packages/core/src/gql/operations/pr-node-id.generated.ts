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
export type PrNodeIdQueryVariables = Exact<{
  owner: string
  name: string
  prNumber: number
}>

export type PrNodeIdQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    pullRequest: { __typename: "PullRequest"; id: string } | null
  } | null
}

export const PrNodeIdDocument = new TypedDocumentString(`
    query PrNodeId($owner: String!, $name: String!, $prNumber: Int!) {
  __typename
  repository(owner: $owner, name: $name) {
    __typename
    pullRequest(number: $prNumber) {
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
    PrNodeId(
      variables: PrNodeIdQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrNodeIdQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrNodeIdQuery>({
            document: PrNodeIdDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrNodeId",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

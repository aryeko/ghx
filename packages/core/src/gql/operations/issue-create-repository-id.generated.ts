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
export type IssueCreateRepositoryIdQueryVariables = Exact<{
  owner: string
  name: string
}>

export type IssueCreateRepositoryIdQuery = {
  __typename: "Query"
  repository: { __typename: "Repository"; id: string } | null
}

export const IssueCreateRepositoryIdDocument = new TypedDocumentString(`
    query IssueCreateRepositoryId($owner: String!, $name: String!) {
  __typename
  repository(owner: $owner, name: $name) {
    __typename
    id
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
    IssueCreateRepositoryId(
      variables: IssueCreateRepositoryIdQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueCreateRepositoryIdQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueCreateRepositoryIdQuery>({
            document: IssueCreateRepositoryIdDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueCreateRepositoryId",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

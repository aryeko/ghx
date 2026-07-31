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
export type ProjectV2OwnerIdQueryVariables = Exact<{
  owner: string
  projectNumber: number
}>

export type ProjectV2OwnerIdQuery = {
  __typename: "Query"
  repositoryOwner:
    | { __typename: "Organization"; projectV2: { __typename: "ProjectV2"; id: string } | null }
    | { __typename: "User"; projectV2: { __typename: "ProjectV2"; id: string } | null }
    | null
}

export const ProjectV2OwnerIdDocument = new TypedDocumentString(`
    query ProjectV2OwnerId($owner: String!, $projectNumber: Int!) {
  __typename
  repositoryOwner(login: $owner) {
    __typename
    ... on ProjectV2Owner {
      __typename
      projectV2(number: $projectNumber) {
        __typename
        id
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
    ProjectV2OwnerId(
      variables: ProjectV2OwnerIdQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ProjectV2OwnerIdQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ProjectV2OwnerIdQuery>({
            document: ProjectV2OwnerIdDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ProjectV2OwnerId",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

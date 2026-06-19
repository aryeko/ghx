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
export type ProjectV2OrgIdQueryVariables = Exact<{
  org: string
  projectNumber: number
}>

export type ProjectV2OrgIdQuery = {
  __typename: "Query"
  organization: {
    __typename: "Organization"
    projectV2: { __typename: "ProjectV2"; id: string } | null
  } | null
}

export const ProjectV2OrgIdDocument = new TypedDocumentString(`
    query ProjectV2OrgId($org: String!, $projectNumber: Int!) {
  __typename
  organization(login: $org) {
    __typename
    projectV2(number: $projectNumber) {
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
    ProjectV2OrgId(
      variables: ProjectV2OrgIdQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ProjectV2OrgIdQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ProjectV2OrgIdQuery>({
            document: ProjectV2OrgIdDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ProjectV2OrgId",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

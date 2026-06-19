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
export type ProjectV2OrgViewQueryVariables = Exact<{
  org: string
  projectNumber: number
}>

export type ProjectV2OrgViewQuery = {
  __typename: "Query"
  organization: {
    __typename: "Organization"
    projectV2: {
      __typename: "ProjectV2"
      id: string
      title: string
      shortDescription: string | null
      public: boolean
      closed: boolean
      url: any
    } | null
  } | null
}

export const ProjectV2OrgViewDocument = new TypedDocumentString(`
    query ProjectV2OrgView($org: String!, $projectNumber: Int!) {
  __typename
  organization(login: $org) {
    __typename
    projectV2(number: $projectNumber) {
      __typename
      id
      title
      shortDescription
      public
      closed
      url
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
    ProjectV2OrgView(
      variables: ProjectV2OrgViewQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ProjectV2OrgViewQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ProjectV2OrgViewQuery>({
            document: ProjectV2OrgViewDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ProjectV2OrgView",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

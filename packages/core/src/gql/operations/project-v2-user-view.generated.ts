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
export type ProjectV2UserViewQueryVariables = Exact<{
  user: string
  projectNumber: number
}>

export type ProjectV2UserViewQuery = {
  __typename: "Query"
  user: {
    __typename: "User"
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

export const ProjectV2UserViewDocument = new TypedDocumentString(`
    query ProjectV2UserView($user: String!, $projectNumber: Int!) {
  __typename
  user(login: $user) {
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
    ProjectV2UserView(
      variables: ProjectV2UserViewQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ProjectV2UserViewQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ProjectV2UserViewQuery>({
            document: ProjectV2UserViewDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ProjectV2UserView",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

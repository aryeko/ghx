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
export type ProjectV2UserIdQueryVariables = Exact<{
  login: string
  number: number
}>

export type ProjectV2UserIdQuery = {
  __typename: "Query"
  user: { __typename: "User"; projectV2: { __typename: "ProjectV2"; id: string } | null } | null
}

export const ProjectV2UserIdDocument = new TypedDocumentString(`
    query ProjectV2UserId($login: String!, $number: Int!) {
  __typename
  user(login: $login) {
    __typename
    projectV2(number: $number) {
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
    ProjectV2UserId(
      variables: ProjectV2UserIdQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ProjectV2UserIdQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ProjectV2UserIdQuery>({
            document: ProjectV2UserIdDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ProjectV2UserId",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

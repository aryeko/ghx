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
/** The type of a project item. */
export type ProjectV2ItemType =
  /** Draft Issue */
  | "DRAFT_ISSUE"
  /** Issue */
  | "ISSUE"
  /** Pull Request */
  | "PULL_REQUEST"
  /** Redacted Item */
  | "REDACTED"

export type AddProjectV2ItemMutationVariables = Exact<{
  projectId: string | number
  contentId: string | number
}>

export type AddProjectV2ItemMutation = {
  __typename: "Mutation"
  addProjectV2ItemById: {
    __typename: "AddProjectV2ItemByIdPayload"
    item: { __typename: "ProjectV2Item"; id: string; type: Types.ProjectV2ItemType } | null
  } | null
}

export const AddProjectV2ItemDocument = new TypedDocumentString(`
    mutation AddProjectV2Item($projectId: ID!, $contentId: ID!) {
  __typename
  addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
    __typename
    item {
      __typename
      id
      type
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
    AddProjectV2Item(
      variables: AddProjectV2ItemMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<AddProjectV2ItemMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<AddProjectV2ItemMutation>({
            document: AddProjectV2ItemDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "AddProjectV2Item",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

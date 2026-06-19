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
export type RemoveProjectV2ItemMutationVariables = Exact<{
  projectId: string | number
  itemId: string | number
}>

export type RemoveProjectV2ItemMutation = {
  __typename: "Mutation"
  deleteProjectV2Item: {
    __typename: "DeleteProjectV2ItemPayload"
    deletedItemId: string | null
  } | null
}

export const RemoveProjectV2ItemDocument = new TypedDocumentString(`
    mutation RemoveProjectV2Item($projectId: ID!, $itemId: ID!) {
  __typename
  deleteProjectV2Item(input: {projectId: $projectId, itemId: $itemId}) {
    __typename
    deletedItemId
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
    RemoveProjectV2Item(
      variables: RemoveProjectV2ItemMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<RemoveProjectV2ItemMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<RemoveProjectV2ItemMutation>({
            document: RemoveProjectV2ItemDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "RemoveProjectV2Item",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

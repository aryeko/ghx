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
export type PrAssigneesRemoveMutationVariables = Exact<{
  assignableId: string | number
  assigneeIds: Array<string | number> | string | number
}>

export type PrAssigneesRemoveMutation = {
  __typename: "Mutation"
  removeAssigneesFromAssignable: {
    __typename: "RemoveAssigneesFromAssignablePayload"
    assignable:
      | { __typename: "Issue" }
      | {
          __typename: "PullRequest"
          id: string
          assignees: {
            __typename: "UserConnection"
            nodes: Array<{ __typename: "User"; login: string } | null> | null
          }
        }
      | null
  } | null
}

export const PrAssigneesRemoveDocument = new TypedDocumentString(`
    mutation PrAssigneesRemove($assignableId: ID!, $assigneeIds: [ID!]!) {
  __typename
  removeAssigneesFromAssignable(
    input: {assignableId: $assignableId, assigneeIds: $assigneeIds}
  ) {
    __typename
    assignable {
      __typename
      ... on PullRequest {
        __typename
        id
        assignees(first: 50) {
          __typename
          nodes {
            __typename
            login
          }
        }
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
    PrAssigneesRemove(
      variables: PrAssigneesRemoveMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrAssigneesRemoveMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrAssigneesRemoveMutation>({
            document: PrAssigneesRemoveDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrAssigneesRemove",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

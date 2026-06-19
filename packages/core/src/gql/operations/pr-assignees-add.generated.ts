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
export type PrAssigneesAddMutationVariables = Exact<{
  assignableId: string | number
  assigneeIds: Array<string | number> | string | number
}>

export type PrAssigneesAddMutation = {
  __typename: "Mutation"
  addAssigneesToAssignable: {
    __typename: "AddAssigneesToAssignablePayload"
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

export const PrAssigneesAddDocument = new TypedDocumentString(`
    mutation PrAssigneesAdd($assignableId: ID!, $assigneeIds: [ID!]!) {
  addAssigneesToAssignable(
    input: {assignableId: $assignableId, assigneeIds: $assigneeIds}
  ) {
    assignable {
      ... on PullRequest {
        id
        assignees(first: 50) {
          nodes {
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
    PrAssigneesAdd(
      variables: PrAssigneesAddMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrAssigneesAddMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrAssigneesAddMutation>({
            document: PrAssigneesAddDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrAssigneesAdd",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

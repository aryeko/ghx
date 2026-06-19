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
export type IssueAssigneesAddMutationVariables = Exact<{
  assignableId: string | number
  assigneeIds: Array<string | number> | string | number
}>

export type IssueAssigneesAddMutation = {
  __typename: "Mutation"
  addAssigneesToAssignable: {
    __typename: "AddAssigneesToAssignablePayload"
    assignable:
      | {
          __typename: "Issue"
          id: string
          assignees: {
            __typename: "UserConnection"
            nodes: Array<{ __typename: "User"; login: string } | null> | null
          }
        }
      | { __typename: "PullRequest" }
      | null
  } | null
}

export const IssueAssigneesAddDocument = new TypedDocumentString(`
    mutation IssueAssigneesAdd($assignableId: ID!, $assigneeIds: [ID!]!) {
  __typename
  addAssigneesToAssignable(
    input: {assignableId: $assignableId, assigneeIds: $assigneeIds}
  ) {
    __typename
    assignable {
      __typename
      ... on Issue {
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
    IssueAssigneesAdd(
      variables: IssueAssigneesAddMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueAssigneesAddMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueAssigneesAddMutation>({
            document: IssueAssigneesAddDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueAssigneesAdd",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

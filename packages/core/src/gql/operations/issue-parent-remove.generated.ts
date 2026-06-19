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
export type IssueParentRemoveMutationVariables = Exact<{
  issueId: string | number
  parentIssueId: string | number
}>

export type IssueParentRemoveMutation = {
  __typename: "Mutation"
  removeSubIssue: {
    __typename: "RemoveSubIssuePayload"
    issue: { __typename: "Issue"; id: string } | null
    subIssue: { __typename: "Issue"; id: string } | null
  } | null
}

export const IssueParentRemoveDocument = new TypedDocumentString(`
    mutation IssueParentRemove($issueId: ID!, $parentIssueId: ID!) {
  removeSubIssue(input: {issueId: $parentIssueId, subIssueId: $issueId}) {
    issue {
      id
    }
    subIssue {
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
    IssueParentRemove(
      variables: IssueParentRemoveMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueParentRemoveMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueParentRemoveMutation>({
            document: IssueParentRemoveDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueParentRemove",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

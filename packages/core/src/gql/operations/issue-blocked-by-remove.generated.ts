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
export type IssueBlockedByRemoveMutationVariables = Exact<{
  issueId: string | number
  blockedByIssueId: string | number
}>

export type IssueBlockedByRemoveMutation = {
  __typename: "Mutation"
  removeBlockedBy: {
    __typename: "RemoveBlockedByPayload"
    issue: { __typename: "Issue"; id: string } | null
    blockingIssue: { __typename: "Issue"; id: string } | null
  } | null
}

export const IssueBlockedByRemoveDocument = new TypedDocumentString(`
    mutation IssueBlockedByRemove($issueId: ID!, $blockedByIssueId: ID!) {
  removeBlockedBy(input: {issueId: $issueId, blockingIssueId: $blockedByIssueId}) {
    issue {
      id
    }
    blockingIssue {
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
    IssueBlockedByRemove(
      variables: IssueBlockedByRemoveMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueBlockedByRemoveMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueBlockedByRemoveMutation>({
            document: IssueBlockedByRemoveDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueBlockedByRemove",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

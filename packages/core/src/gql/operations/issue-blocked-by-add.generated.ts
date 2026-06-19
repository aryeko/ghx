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
export type IssueBlockedByAddMutationVariables = Exact<{
  issueId: string | number
  blockedByIssueId: string | number
}>

export type IssueBlockedByAddMutation = {
  __typename: "Mutation"
  addBlockedBy: {
    __typename: "AddBlockedByPayload"
    issue: { __typename: "Issue"; id: string } | null
    blockingIssue: { __typename: "Issue"; id: string } | null
  } | null
}

export const IssueBlockedByAddDocument = new TypedDocumentString(`
    mutation IssueBlockedByAdd($issueId: ID!, $blockedByIssueId: ID!) {
  __typename
  addBlockedBy(input: {issueId: $issueId, blockingIssueId: $blockedByIssueId}) {
    __typename
    issue {
      __typename
      id
    }
    blockingIssue {
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
    IssueBlockedByAdd(
      variables: IssueBlockedByAddMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueBlockedByAddMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueBlockedByAddMutation>({
            document: IssueBlockedByAddDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueBlockedByAdd",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

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
/** The possible states of an issue. */
export type IssueState =
  /** An issue that has been closed */
  | "CLOSED"
  /** An issue that is still open */
  | "OPEN"

export type IssueReopenMutationVariables = Exact<{
  issueId: string | number
}>

export type IssueReopenMutation = {
  __typename: "Mutation"
  reopenIssue: {
    __typename: "ReopenIssuePayload"
    issue: { __typename: "Issue"; id: string; number: number; state: Types.IssueState } | null
  } | null
}

export const IssueReopenDocument = new TypedDocumentString(`
    mutation IssueReopen($issueId: ID!) {
  reopenIssue(input: {issueId: $issueId}) {
    issue {
      id
      number
      state
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
    IssueReopen(
      variables: IssueReopenMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueReopenMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueReopenMutation>({
            document: IssueReopenDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueReopen",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

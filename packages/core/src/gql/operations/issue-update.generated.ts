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

export type IssueUpdateMutationVariables = Exact<{
  issueId: string | number
  title?: string | null | undefined
  body?: string | null | undefined
}>

export type IssueUpdateMutation = {
  __typename: "Mutation"
  updateIssue: {
    __typename: "UpdateIssuePayload"
    issue: {
      __typename: "Issue"
      id: string
      number: number
      title: string
      state: Types.IssueState
      url: any
    } | null
  } | null
}

export const IssueUpdateDocument = new TypedDocumentString(`
    mutation IssueUpdate($issueId: ID!, $title: String, $body: String) {
  __typename
  updateIssue(input: {id: $issueId, title: $title, body: $body}) {
    __typename
    issue {
      __typename
      id
      number
      title
      state
      url
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
    IssueUpdate(
      variables: IssueUpdateMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueUpdateMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueUpdateMutation>({
            document: IssueUpdateDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueUpdate",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

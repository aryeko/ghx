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

export type IssueCreateMutationVariables = Exact<{
  repositoryId: string | number
  title: string
  body?: string | null | undefined
}>

export type IssueCreateMutation = {
  __typename: "Mutation"
  createIssue: {
    __typename: "CreateIssuePayload"
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

export const IssueCreateDocument = new TypedDocumentString(`
    mutation IssueCreate($repositoryId: ID!, $title: String!, $body: String) {
  createIssue(input: {repositoryId: $repositoryId, title: $title, body: $body}) {
    issue {
      ...IssueCoreFields
    }
  }
}
    fragment IssueCoreFields on Issue {
  id
  number
  title
  state
  url
}`)

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
    IssueCreate(
      variables: IssueCreateMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueCreateMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueCreateMutation>({
            document: IssueCreateDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueCreate",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

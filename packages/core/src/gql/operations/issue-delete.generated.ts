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
export type IssueDeleteMutationVariables = Exact<{
  issueId: string | number
}>

export type IssueDeleteMutation = {
  __typename: "Mutation"
  deleteIssue: { __typename: "DeleteIssuePayload"; clientMutationId: string | null } | null
}

export const IssueDeleteDocument = new TypedDocumentString(`
    mutation IssueDelete($issueId: ID!) {
  deleteIssue(input: {issueId: $issueId}) {
    clientMutationId
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
    IssueDelete(
      variables: IssueDeleteMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueDeleteMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueDeleteMutation>({
            document: IssueDeleteDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueDelete",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

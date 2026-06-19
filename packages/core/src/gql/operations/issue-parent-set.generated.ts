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
export type IssueParentSetMutationVariables = Exact<{
  issueId: string | number
  parentIssueId: string | number
}>

export type IssueParentSetMutation = {
  __typename: "Mutation"
  addSubIssue: {
    __typename: "AddSubIssuePayload"
    issue: { __typename: "Issue"; id: string } | null
    subIssue: { __typename: "Issue"; id: string } | null
  } | null
}

export const IssueParentSetDocument = new TypedDocumentString(`
    mutation IssueParentSet($issueId: ID!, $parentIssueId: ID!) {
  __typename
  addSubIssue(input: {issueId: $parentIssueId, subIssueId: $issueId}) {
    __typename
    issue {
      __typename
      id
    }
    subIssue {
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
    IssueParentSet(
      variables: IssueParentSetMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueParentSetMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueParentSetMutation>({
            document: IssueParentSetDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueParentSet",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

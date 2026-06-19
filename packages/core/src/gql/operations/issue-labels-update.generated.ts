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
export type IssueLabelsUpdateMutationVariables = Exact<{
  issueId: string | number
  labelIds: Array<string | number> | string | number
}>

export type IssueLabelsUpdateMutation = {
  __typename: "Mutation"
  updateIssue: {
    __typename: "UpdateIssuePayload"
    issue: {
      __typename: "Issue"
      id: string
      labels: {
        __typename: "LabelConnection"
        nodes: Array<{ __typename: "Label"; name: string } | null> | null
      } | null
    } | null
  } | null
}

export const IssueLabelsUpdateDocument = new TypedDocumentString(`
    mutation IssueLabelsUpdate($issueId: ID!, $labelIds: [ID!]!) {
  updateIssue(input: {id: $issueId, labelIds: $labelIds}) {
    issue {
      id
      labels(first: 50) {
        nodes {
          name
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
    IssueLabelsUpdate(
      variables: IssueLabelsUpdateMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueLabelsUpdateMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueLabelsUpdateMutation>({
            document: IssueLabelsUpdateDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueLabelsUpdate",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

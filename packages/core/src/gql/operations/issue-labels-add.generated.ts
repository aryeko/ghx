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
export type IssueLabelsAddMutationVariables = Exact<{
  labelableId: string | number
  labelIds: Array<string | number> | string | number
}>

export type IssueLabelsAddMutation = {
  __typename: "Mutation"
  addLabelsToLabelable: {
    __typename: "AddLabelsToLabelablePayload"
    labelable:
      | { __typename: "Discussion" }
      | {
          __typename: "Issue"
          id: string
          labels: {
            __typename: "LabelConnection"
            nodes: Array<{ __typename: "Label"; name: string } | null> | null
          } | null
        }
      | { __typename: "PullRequest" }
      | null
  } | null
}

export const IssueLabelsAddDocument = new TypedDocumentString(`
    mutation IssueLabelsAdd($labelableId: ID!, $labelIds: [ID!]!) {
  __typename
  addLabelsToLabelable(input: {labelableId: $labelableId, labelIds: $labelIds}) {
    __typename
    labelable {
      __typename
      ... on Issue {
        __typename
        id
        labels(first: 50) {
          __typename
          nodes {
            __typename
            name
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
    IssueLabelsAdd(
      variables: IssueLabelsAddMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueLabelsAddMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueLabelsAddMutation>({
            document: IssueLabelsAddDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueLabelsAdd",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

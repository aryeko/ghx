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

export type IssueViewQueryVariables = Exact<{
  owner: string
  name: string
  issueNumber: number
}>

export type IssueViewQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    issue: {
      __typename: "Issue"
      body: string
      id: string
      number: number
      title: string
      state: Types.IssueState
      url: any
      labels: {
        __typename: "LabelConnection"
        nodes: Array<{ __typename: "Label"; name: string } | null> | null
      } | null
    } | null
  } | null
}

export const IssueViewDocument = new TypedDocumentString(`
    query IssueView($owner: String!, $name: String!, $issueNumber: Int!) {
  __typename
  repository(owner: $owner, name: $name) {
    __typename
    issue(number: $issueNumber) {
      __typename
      ...IssueCoreFields
      body
      labels(first: 20) {
        __typename
        nodes {
          __typename
          name
        }
      }
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
    IssueView(
      variables: IssueViewQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueViewQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueViewQuery>({
            document: IssueViewDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueView",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

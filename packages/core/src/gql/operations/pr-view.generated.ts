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
/** The possible states of a pull request. */
export type PullRequestState =
  /** A pull request that has been closed without being merged. */
  | "CLOSED"
  /** A pull request that has been closed by being merged. */
  | "MERGED"
  /** A pull request that is still open. */
  | "OPEN"

export type PrViewQueryVariables = Exact<{
  owner: string
  name: string
  prNumber: number
}>

export type PrViewQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    pullRequest: {
      __typename: "PullRequest"
      body: string
      id: string
      number: number
      title: string
      state: Types.PullRequestState
      url: any
      labels: {
        __typename: "LabelConnection"
        nodes: Array<{ __typename: "Label"; name: string } | null> | null
      } | null
    } | null
  } | null
}

export const PrViewDocument = new TypedDocumentString(`
    query PrView($owner: String!, $name: String!, $prNumber: Int!) {
  __typename
  repository(owner: $owner, name: $name) {
    __typename
    pullRequest(number: $prNumber) {
      __typename
      ...PrCoreFields
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
    fragment PrCoreFields on PullRequest {
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
    PrView(
      variables: PrViewQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrViewQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrViewQuery>({
            document: PrViewDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrView",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

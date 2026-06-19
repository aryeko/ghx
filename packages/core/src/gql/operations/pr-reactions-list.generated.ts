import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"
import { TypedDocumentString } from "./typed-document-string.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrReactionsListQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  prNumber: Types.Scalars["Int"]["input"]
}>

export type PrReactionsListQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    pullRequest?: {
      __typename?: "PullRequest"
      id: string
      url: any
      reactionGroups?: Array<{
        __typename?: "ReactionGroup"
        content: Types.ReactionContent
        viewerHasReacted: boolean
        reactors: {
          __typename?: "ReactorConnection"
          totalCount: number
          nodes?: Array<
            | { __typename: "Bot"; login: string }
            | { __typename: "Mannequin"; login: string }
            | { __typename: "Organization"; login: string }
            | { __typename: "User"; login: string }
            | null
          > | null
        }
      }> | null
    } | null
  } | null
}

export const PrReactionsListDocument = new TypedDocumentString(`
    query PrReactionsList($owner: String!, $name: String!, $prNumber: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $prNumber) {
      id
      url
      reactionGroups {
        ...ReactionGroupFields
      }
    }
  }
}
    fragment ReactionGroupFields on ReactionGroup {
  content
  viewerHasReacted
  reactors(first: 100) {
    totalCount
    nodes {
      __typename
      ... on User {
        login
      }
      ... on Bot {
        login
      }
      ... on Organization {
        login
      }
      ... on Mannequin {
        login
      }
    }
  }
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
    PrReactionsList(
      variables: PrReactionsListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrReactionsListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrReactionsListQuery>({
            document: PrReactionsListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrReactionsList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

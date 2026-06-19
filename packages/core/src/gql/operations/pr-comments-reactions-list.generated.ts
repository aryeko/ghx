import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"
import { TypedDocumentString } from "./typed-document-string.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrCommentsReactionsListQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  prNumber: Types.Scalars["Int"]["input"]
  commentsFirst: Types.Scalars["Int"]["input"]
  threadsFirst: Types.Scalars["Int"]["input"]
  threadCommentsFirst: Types.Scalars["Int"]["input"]
}>

export type PrCommentsReactionsListQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    pullRequest?: {
      __typename?: "PullRequest"
      comments: {
        __typename?: "IssueCommentConnection"
        pageInfo: { __typename?: "PageInfo"; hasNextPage: boolean }
        nodes?: Array<{
          __typename: "IssueComment"
          id: string
          url: any
          author?:
            | { __typename?: "Bot"; login: string }
            | { __typename?: "EnterpriseUserAccount"; login: string }
            | { __typename?: "Mannequin"; login: string }
            | { __typename?: "Organization"; login: string }
            | { __typename?: "User"; login: string }
            | null
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
        } | null> | null
      }
      reviewThreads: {
        __typename?: "PullRequestReviewThreadConnection"
        pageInfo: { __typename?: "PageInfo"; hasNextPage: boolean }
        nodes?: Array<{
          __typename?: "PullRequestReviewThread"
          comments: {
            __typename?: "PullRequestReviewCommentConnection"
            pageInfo: { __typename?: "PageInfo"; hasNextPage: boolean }
            nodes?: Array<{
              __typename: "PullRequestReviewComment"
              id: string
              url: any
              author?:
                | { __typename?: "Bot"; login: string }
                | { __typename?: "EnterpriseUserAccount"; login: string }
                | { __typename?: "Mannequin"; login: string }
                | { __typename?: "Organization"; login: string }
                | { __typename?: "User"; login: string }
                | null
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
            } | null> | null
          }
        } | null> | null
      }
    } | null
  } | null
}

export const PrCommentsReactionsListDocument = new TypedDocumentString(`
    query PrCommentsReactionsList($owner: String!, $name: String!, $prNumber: Int!, $commentsFirst: Int!, $threadsFirst: Int!, $threadCommentsFirst: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $prNumber) {
      comments(first: $commentsFirst) {
        pageInfo {
          hasNextPage
        }
        nodes {
          __typename
          id
          url
          author {
            login
          }
          reactionGroups {
            ...ReactionGroupFields
          }
        }
      }
      reviewThreads(first: $threadsFirst) {
        pageInfo {
          hasNextPage
        }
        nodes {
          comments(first: $threadCommentsFirst) {
            pageInfo {
              hasNextPage
            }
            nodes {
              __typename
              id
              url
              author {
                login
              }
              reactionGroups {
                ...ReactionGroupFields
              }
            }
          }
        }
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
    PrCommentsReactionsList(
      variables: PrCommentsReactionsListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrCommentsReactionsListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrCommentsReactionsListQuery>({
            document: PrCommentsReactionsListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrCommentsReactionsList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

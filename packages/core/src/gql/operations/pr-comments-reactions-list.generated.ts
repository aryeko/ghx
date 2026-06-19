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
/** Emojis that can be attached to Issues, Pull Requests and Comments. */
export type ReactionContent =
  /** Represents the `:confused:` emoji. */
  | "CONFUSED"
  /** Represents the `:eyes:` emoji. */
  | "EYES"
  /** Represents the `:heart:` emoji. */
  | "HEART"
  /** Represents the `:hooray:` emoji. */
  | "HOORAY"
  /** Represents the `:laugh:` emoji. */
  | "LAUGH"
  /** Represents the `:rocket:` emoji. */
  | "ROCKET"
  /** Represents the `:-1:` emoji. */
  | "THUMBS_DOWN"
  /** Represents the `:+1:` emoji. */
  | "THUMBS_UP"

export type PrCommentsReactionsListQueryVariables = Exact<{
  owner: string
  name: string
  prNumber: number
  commentsFirst: number
  threadsFirst: number
  threadCommentsFirst: number
}>

export type PrCommentsReactionsListQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    pullRequest: {
      __typename: "PullRequest"
      comments: {
        __typename: "IssueCommentConnection"
        pageInfo: { __typename: "PageInfo"; hasNextPage: boolean }
        nodes: Array<{
          __typename: "IssueComment"
          id: string
          url: any
          author:
            | { __typename: "Bot"; login: string }
            | { __typename: "EnterpriseUserAccount"; login: string }
            | { __typename: "Mannequin"; login: string }
            | { __typename: "Organization"; login: string }
            | { __typename: "User"; login: string }
            | null
          reactionGroups: Array<{
            __typename: "ReactionGroup"
            content: Types.ReactionContent
            viewerHasReacted: boolean
            reactors: {
              __typename: "ReactorConnection"
              totalCount: number
              nodes: Array<
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
        __typename: "PullRequestReviewThreadConnection"
        pageInfo: { __typename: "PageInfo"; hasNextPage: boolean }
        nodes: Array<{
          __typename: "PullRequestReviewThread"
          comments: {
            __typename: "PullRequestReviewCommentConnection"
            pageInfo: { __typename: "PageInfo"; hasNextPage: boolean }
            nodes: Array<{
              __typename: "PullRequestReviewComment"
              id: string
              url: any
              author:
                | { __typename: "Bot"; login: string }
                | { __typename: "EnterpriseUserAccount"; login: string }
                | { __typename: "Mannequin"; login: string }
                | { __typename: "Organization"; login: string }
                | { __typename: "User"; login: string }
                | null
              reactionGroups: Array<{
                __typename: "ReactionGroup"
                content: Types.ReactionContent
                viewerHasReacted: boolean
                reactors: {
                  __typename: "ReactorConnection"
                  totalCount: number
                  nodes: Array<
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
  __typename
  repository(owner: $owner, name: $name) {
    __typename
    pullRequest(number: $prNumber) {
      __typename
      comments(first: $commentsFirst) {
        __typename
        pageInfo {
          __typename
          hasNextPage
        }
        nodes {
          __typename
          id
          url
          author {
            __typename
            login
          }
          reactionGroups {
            __typename
            ...ReactionGroupFields
          }
        }
      }
      reviewThreads(first: $threadsFirst) {
        __typename
        pageInfo {
          __typename
          hasNextPage
        }
        nodes {
          __typename
          comments(first: $threadCommentsFirst) {
            __typename
            pageInfo {
              __typename
              hasNextPage
            }
            nodes {
              __typename
              id
              url
              author {
                __typename
                login
              }
              reactionGroups {
                __typename
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

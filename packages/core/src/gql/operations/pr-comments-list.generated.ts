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
/** The possible sides of a diff. */
export type DiffSide =
  /** The left side of the diff. */
  | "LEFT"
  /** The right side of the diff. */
  | "RIGHT"

/** The possible subject types of a pull request review comment. */
export type PullRequestReviewThreadSubjectType =
  /** A comment that has been made against the file of a pull request */
  | "FILE"
  /** A comment that has been made against the line of a pull request */
  | "LINE"

export type PrCommentsListQueryVariables = Exact<{
  owner: string
  name: string
  prNumber: number
  first: number
  after?: string | null | undefined
}>

export type PrCommentsListQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    pullRequest: {
      __typename: "PullRequest"
      reviewThreads: {
        __typename: "PullRequestReviewThreadConnection"
        edges: Array<{
          __typename: "PullRequestReviewThreadEdge"
          cursor: string
          node: {
            __typename: "PullRequestReviewThread"
            id: string
            path: string
            line: number | null
            startLine: number | null
            diffSide: Types.DiffSide
            subjectType: Types.PullRequestReviewThreadSubjectType
            isResolved: boolean
            isOutdated: boolean
            viewerCanReply: boolean
            viewerCanResolve: boolean
            viewerCanUnresolve: boolean
            resolvedBy: { __typename: "User"; login: string } | null
            comments: {
              __typename: "PullRequestReviewCommentConnection"
              nodes: Array<{
                __typename: "PullRequestReviewComment"
                id: string
                body: string
                createdAt: any
                url: any
                author:
                  | { __typename: "Bot"; login: string }
                  | { __typename: "EnterpriseUserAccount"; login: string }
                  | { __typename: "Mannequin"; login: string }
                  | { __typename: "Organization"; login: string }
                  | { __typename: "User"; login: string }
                  | null
              } | null> | null
            }
          } | null
        } | null> | null
        pageInfo: { __typename: "PageInfo"; endCursor: string | null; hasNextPage: boolean }
      }
    } | null
  } | null
}

export const PrCommentsListDocument = new TypedDocumentString(`
    query PrCommentsList($owner: String!, $name: String!, $prNumber: Int!, $first: Int!, $after: String) {
  __typename
  repository(owner: $owner, name: $name) {
    __typename
    pullRequest(number: $prNumber) {
      __typename
      reviewThreads(first: $first, after: $after) {
        __typename
        edges {
          __typename
          cursor
          node {
            __typename
            id
            path
            line
            startLine
            diffSide
            subjectType
            isResolved
            isOutdated
            viewerCanReply
            viewerCanResolve
            viewerCanUnresolve
            resolvedBy {
              __typename
              login
            }
            comments(first: 20) {
              __typename
              nodes {
                __typename
                id
                body
                createdAt
                url
                author {
                  __typename
                  login
                }
              }
            }
          }
        }
        pageInfo {
          __typename
          ...PageInfoFields
        }
      }
    }
  }
}
    fragment PageInfoFields on PageInfo {
  endCursor
  hasNextPage
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
    PrCommentsList(
      variables: PrCommentsListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrCommentsListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrCommentsListQuery>({
            document: PrCommentsListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrCommentsList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

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
/** The type of a project item. */
export type ProjectV2ItemType =
  /** Draft Issue */
  | "DRAFT_ISSUE"
  /** Issue */
  | "ISSUE"
  /** Pull Request */
  | "PULL_REQUEST"
  /** Redacted Item */
  | "REDACTED"

export type ProjectV2ItemsListQueryVariables = Exact<{
  owner: string
  projectNumber: number
  first: number
  after?: string | null | undefined
}>

export type ProjectV2ItemsListQuery = {
  __typename: "Query"
  organization: {
    __typename: "Organization"
    projectV2: {
      __typename: "ProjectV2"
      items: {
        __typename: "ProjectV2ItemConnection"
        nodes: Array<{
          __typename: "ProjectV2Item"
          id: string
          type: Types.ProjectV2ItemType
          content:
            | { __typename: "DraftIssue"; title: string }
            | { __typename: "Issue"; number: number; title: string }
            | { __typename: "PullRequest"; number: number; title: string }
            | null
        } | null> | null
        pageInfo: { __typename: "PageInfo"; endCursor: string | null; hasNextPage: boolean }
      }
    } | null
  } | null
  user: {
    __typename: "User"
    projectV2: {
      __typename: "ProjectV2"
      items: {
        __typename: "ProjectV2ItemConnection"
        nodes: Array<{
          __typename: "ProjectV2Item"
          id: string
          type: Types.ProjectV2ItemType
          content:
            | { __typename: "DraftIssue"; title: string }
            | { __typename: "Issue"; number: number; title: string }
            | { __typename: "PullRequest"; number: number; title: string }
            | null
        } | null> | null
        pageInfo: { __typename: "PageInfo"; endCursor: string | null; hasNextPage: boolean }
      }
    } | null
  } | null
}

export const ProjectV2ItemsListDocument = new TypedDocumentString(`
    query ProjectV2ItemsList($owner: String!, $projectNumber: Int!, $first: Int!, $after: String) {
  __typename
  organization(login: $owner) {
    __typename
    projectV2(number: $projectNumber) {
      __typename
      items(first: $first, after: $after) {
        __typename
        nodes {
          __typename
          id
          type
          content {
            __typename
            ... on Issue {
              __typename
              number
              title
            }
            ... on PullRequest {
              __typename
              number
              title
            }
            ... on DraftIssue {
              __typename
              title
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
  user(login: $owner) {
    __typename
    projectV2(number: $projectNumber) {
      __typename
      items(first: $first, after: $after) {
        __typename
        nodes {
          __typename
          id
          type
          content {
            __typename
            ... on Issue {
              __typename
              number
              title
            }
            ... on PullRequest {
              __typename
              number
              title
            }
            ... on DraftIssue {
              __typename
              title
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
    ProjectV2ItemsList(
      variables: ProjectV2ItemsListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ProjectV2ItemsListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ProjectV2ItemsListQuery>({
            document: ProjectV2ItemsListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ProjectV2ItemsList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

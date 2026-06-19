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

export type IssueLinkedPrsListQueryVariables = Exact<{
  owner: string
  name: string
  issueNumber: number
}>

export type IssueLinkedPrsListQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    issue: {
      __typename: "Issue"
      timelineItems: {
        __typename: "IssueTimelineItemsConnection"
        nodes: Array<
          | { __typename: "AddedToProjectEvent" }
          | { __typename: "AddedToProjectV2Event" }
          | { __typename: "AssignedEvent" }
          | { __typename: "BlockedByAddedEvent" }
          | { __typename: "BlockedByRemovedEvent" }
          | { __typename: "BlockingAddedEvent" }
          | { __typename: "BlockingRemovedEvent" }
          | { __typename: "ClosedEvent" }
          | { __typename: "CommentDeletedEvent" }
          | {
              __typename: "ConnectedEvent"
              subject:
                | { __typename: "Issue" }
                | {
                    __typename: "PullRequest"
                    id: string
                    number: number
                    title: string
                    state: Types.PullRequestState
                    url: any
                  }
            }
          | { __typename: "ConvertedFromDraftEvent" }
          | { __typename: "ConvertedNoteToIssueEvent" }
          | { __typename: "ConvertedToDiscussionEvent" }
          | { __typename: "CrossReferencedEvent" }
          | { __typename: "DemilestonedEvent" }
          | { __typename: "DisconnectedEvent" }
          | { __typename: "IssueComment" }
          | { __typename: "IssueTypeAddedEvent" }
          | { __typename: "IssueTypeChangedEvent" }
          | { __typename: "IssueTypeRemovedEvent" }
          | { __typename: "LabeledEvent" }
          | { __typename: "LockedEvent" }
          | { __typename: "MarkedAsDuplicateEvent" }
          | { __typename: "MentionedEvent" }
          | { __typename: "MilestonedEvent" }
          | { __typename: "MovedColumnsInProjectEvent" }
          | { __typename: "ParentIssueAddedEvent" }
          | { __typename: "ParentIssueRemovedEvent" }
          | { __typename: "PinnedEvent" }
          | { __typename: "ProjectV2ItemStatusChangedEvent" }
          | { __typename: "ReferencedEvent" }
          | { __typename: "RemovedFromProjectEvent" }
          | { __typename: "RemovedFromProjectV2Event" }
          | { __typename: "RenamedTitleEvent" }
          | { __typename: "ReopenedEvent" }
          | { __typename: "SubIssueAddedEvent" }
          | { __typename: "SubIssueRemovedEvent" }
          | { __typename: "SubscribedEvent" }
          | { __typename: "TransferredEvent" }
          | { __typename: "UnassignedEvent" }
          | { __typename: "UnlabeledEvent" }
          | { __typename: "UnlockedEvent" }
          | { __typename: "UnmarkedAsDuplicateEvent" }
          | { __typename: "UnpinnedEvent" }
          | { __typename: "UnsubscribedEvent" }
          | { __typename: "UserBlockedEvent" }
          | null
        > | null
      }
    } | null
  } | null
}

export const IssueLinkedPrsListDocument = new TypedDocumentString(`
    query IssueLinkedPrsList($owner: String!, $name: String!, $issueNumber: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $issueNumber) {
      timelineItems(first: 50, itemTypes: [CONNECTED_EVENT]) {
        nodes {
          __typename
          ... on ConnectedEvent {
            subject {
              __typename
              ... on PullRequest {
                ...PrCoreFields
              }
            }
          }
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
    IssueLinkedPrsList(
      variables: IssueLinkedPrsListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueLinkedPrsListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueLinkedPrsListQuery>({
            document: IssueLinkedPrsListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueLinkedPrsList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

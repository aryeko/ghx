/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never }

import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core"
import type * as Types from "./base-types.js"
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

export const IssueLinkedPrsListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "IssueLinkedPrsList" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "owner" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "name" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "issueNumber" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "__typename" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "repository" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "owner" },
                value: { kind: "Variable", name: { kind: "Name", value: "owner" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "name" },
                value: { kind: "Variable", name: { kind: "Name", value: "name" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "issue" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "number" },
                      value: { kind: "Variable", name: { kind: "Name", value: "issueNumber" } },
                    },
                  ],
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "__typename" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "timelineItems" },
                        arguments: [
                          {
                            kind: "Argument",
                            name: { kind: "Name", value: "first" },
                            value: { kind: "IntValue", value: "50" },
                          },
                          {
                            kind: "Argument",
                            name: { kind: "Name", value: "itemTypes" },
                            value: {
                              kind: "ListValue",
                              values: [{ kind: "EnumValue", value: "CONNECTED_EVENT" }],
                            },
                          },
                        ],
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "__typename" } },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "nodes" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "__typename" } },
                                  {
                                    kind: "InlineFragment",
                                    typeCondition: {
                                      kind: "NamedType",
                                      name: { kind: "Name", value: "ConnectedEvent" },
                                    },
                                    selectionSet: {
                                      kind: "SelectionSet",
                                      selections: [
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "__typename" },
                                        },
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "subject" },
                                          selectionSet: {
                                            kind: "SelectionSet",
                                            selections: [
                                              {
                                                kind: "Field",
                                                name: { kind: "Name", value: "__typename" },
                                              },
                                              {
                                                kind: "InlineFragment",
                                                typeCondition: {
                                                  kind: "NamedType",
                                                  name: { kind: "Name", value: "PullRequest" },
                                                },
                                                selectionSet: {
                                                  kind: "SelectionSet",
                                                  selections: [
                                                    {
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "__typename" },
                                                    },
                                                    {
                                                      kind: "FragmentSpread",
                                                      name: { kind: "Name", value: "PrCoreFields" },
                                                    },
                                                  ],
                                                },
                                              },
                                            ],
                                          },
                                        },
                                      ],
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "PrCoreFields" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "PullRequest" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "number" } },
          { kind: "Field", name: { kind: "Name", value: "title" } },
          { kind: "Field", name: { kind: "Name", value: "state" } },
          { kind: "Field", name: { kind: "Name", value: "url" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<IssueLinkedPrsListQuery, IssueLinkedPrsListQueryVariables>

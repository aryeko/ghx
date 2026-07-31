/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never }

import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core"
import type * as Types from "./base-types.js"
/** Detailed status information about a pull request merge. */
export type MergeStateStatus =
  /** The head ref is out of date. */
  | "BEHIND"
  /** The merge is blocked. */
  | "BLOCKED"
  /** Mergeable and passing commit status. */
  | "CLEAN"
  /** The merge commit cannot be cleanly created. */
  | "DIRTY"
  /** The merge is blocked due to the pull request being a draft. */
  | "DRAFT"
  /** Mergeable with passing commit status and pre-receive hooks. */
  | "HAS_HOOKS"
  /** The state cannot currently be determined. */
  | "UNKNOWN"
  /** Mergeable with non-passing commit status. */
  | "UNSTABLE"

/** Whether or not a PullRequest can be merged. */
export type MergeableState =
  /** The pull request cannot be merged due to merge conflicts. */
  | "CONFLICTING"
  /** The pull request can be merged. */
  | "MERGEABLE"
  /** The mergeability of the pull request is still being calculated. */
  | "UNKNOWN"

/** The review status of a pull request. */
export type PullRequestReviewDecision =
  /** The pull request has received an approving review. */
  | "APPROVED"
  /** Changes have been requested on the pull request. */
  | "CHANGES_REQUESTED"
  /** A review is required before the pull request can be merged. */
  | "REVIEW_REQUIRED"

/** The possible states of a pull request. */
export type PullRequestState =
  /** A pull request that has been closed without being merged. */
  | "CLOSED"
  /** A pull request that has been closed by being merged. */
  | "MERGED"
  /** A pull request that is still open. */
  | "OPEN"

export type PrMergeStatusQueryVariables = Exact<{
  owner: string
  name: string
  prNumber: number
}>

export type PrMergeStatusQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    pullRequest: {
      __typename: "PullRequest"
      mergeable: Types.MergeableState
      mergeStateStatus: Types.MergeStateStatus
      reviewDecision: Types.PullRequestReviewDecision | null
      isDraft: boolean
      state: Types.PullRequestState
    } | null
  } | null
}

export const PrMergeStatusDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "PrMergeStatus" },
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
          variable: { kind: "Variable", name: { kind: "Name", value: "prNumber" } },
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
                  name: { kind: "Name", value: "pullRequest" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "number" },
                      value: { kind: "Variable", name: { kind: "Name", value: "prNumber" } },
                    },
                  ],
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "__typename" } },
                      { kind: "Field", name: { kind: "Name", value: "mergeable" } },
                      { kind: "Field", name: { kind: "Name", value: "mergeStateStatus" } },
                      { kind: "Field", name: { kind: "Name", value: "reviewDecision" } },
                      { kind: "Field", name: { kind: "Name", value: "isDraft" } },
                      { kind: "Field", name: { kind: "Name", value: "state" } },
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
} as unknown as DocumentNode<PrMergeStatusQuery, PrMergeStatusQueryVariables>

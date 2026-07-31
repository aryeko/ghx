/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never }

import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core"
import type * as Types from "./base-types.js"
/** The possible sides of a diff. */
export type DiffSide =
  /** The left side of the diff. */
  | "LEFT"
  /** The right side of the diff. */
  | "RIGHT"

/** Specifies a review comment thread to be left with a Pull Request Review. */
export type DraftPullRequestReviewThread = {
  /** Body of the comment to leave. */
  body: string
  /** The line of the blob to which the thread refers. The end of the line range for multi-line comments. Required if not using positioning. */
  line?: number | null | undefined
  /** Path to the file being commented on. Required if not using positioning. */
  path?: string | null | undefined
  /** The side of the diff on which the line resides. For multi-line comments, this is the side for the end of the line range. */
  side?: DiffSide | null | undefined
  /** The first line of the range to which the comment refers. */
  startLine?: number | null | undefined
  /** The side of the diff on which the start line resides. */
  startSide?: DiffSide | null | undefined
}

/** The possible events to perform on a pull request review. */
export type PullRequestReviewEvent =
  /** Submit feedback and approve merging these changes. */
  | "APPROVE"
  /** Submit general feedback without explicit approval. */
  | "COMMENT"
  /** Dismiss review so it now longer effects merging. */
  | "DISMISS"
  /** Submit feedback that must be addressed before merging. */
  | "REQUEST_CHANGES"

/** The possible states of a pull request review. */
export type PullRequestReviewState =
  /** A review allowing the pull request to merge. */
  | "APPROVED"
  /** A review blocking the pull request from merging. */
  | "CHANGES_REQUESTED"
  /** An informational review. */
  | "COMMENTED"
  /** A review that has been dismissed. */
  | "DISMISSED"
  /** A review that has not yet been submitted. */
  | "PENDING"

export type PrReviewSubmitMutationVariables = Exact<{
  pullRequestId: string | number
  event: Types.PullRequestReviewEvent
  body?: string | null | undefined
  threads?:
    | Array<Types.DraftPullRequestReviewThread>
    | Types.DraftPullRequestReviewThread
    | null
    | undefined
}>

export type PrReviewSubmitMutation = {
  __typename: "Mutation"
  addPullRequestReview: {
    __typename: "AddPullRequestReviewPayload"
    pullRequestReview: {
      __typename: "PullRequestReview"
      id: string
      state: Types.PullRequestReviewState
      url: any
      body: string
    } | null
  } | null
}

export const PrReviewSubmitDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "PrReviewSubmit" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "pullRequestId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "event" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "PullRequestReviewEvent" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "body" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "threads" } },
          type: {
            kind: "ListType",
            type: {
              kind: "NonNullType",
              type: {
                kind: "NamedType",
                name: { kind: "Name", value: "DraftPullRequestReviewThread" },
              },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "__typename" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "addPullRequestReview" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "pullRequestId" },
                      value: { kind: "Variable", name: { kind: "Name", value: "pullRequestId" } },
                    },
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "event" },
                      value: { kind: "Variable", name: { kind: "Name", value: "event" } },
                    },
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "body" },
                      value: { kind: "Variable", name: { kind: "Name", value: "body" } },
                    },
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "threads" },
                      value: { kind: "Variable", name: { kind: "Name", value: "threads" } },
                    },
                  ],
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "pullRequestReview" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "__typename" } },
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "state" } },
                      { kind: "Field", name: { kind: "Name", value: "url" } },
                      { kind: "Field", name: { kind: "Name", value: "body" } },
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
} as unknown as DocumentNode<PrReviewSubmitMutation, PrReviewSubmitMutationVariables>

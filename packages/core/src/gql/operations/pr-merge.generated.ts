/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never }

import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core"
import type * as Types from "./base-types.js"
/** Represents available types of methods to use when merging a pull request. */
export type PullRequestMergeMethod =
  /** Add all commits from the head branch to the base branch with a merge commit. */
  | "MERGE"
  /** Add all commits from the head branch onto the base branch individually. */
  | "REBASE"
  /** Combine all commits from the head branch into a single commit in the base branch. */
  | "SQUASH"

/** The possible states of a pull request. */
export type PullRequestState =
  /** A pull request that has been closed without being merged. */
  | "CLOSED"
  /** A pull request that has been closed by being merged. */
  | "MERGED"
  /** A pull request that is still open. */
  | "OPEN"

export type PrMergeMutationVariables = Exact<{
  pullRequestId: string | number
  mergeMethod?: Types.PullRequestMergeMethod | null | undefined
}>

export type PrMergeMutation = {
  __typename: "Mutation"
  mergePullRequest: {
    __typename: "MergePullRequestPayload"
    pullRequest: {
      __typename: "PullRequest"
      id: string
      number: number
      state: Types.PullRequestState
      merged: boolean
      mergedAt: any
    } | null
  } | null
}

export const PrMergeDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "PrMerge" },
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
          variable: { kind: "Variable", name: { kind: "Name", value: "mergeMethod" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "PullRequestMergeMethod" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "__typename" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "mergePullRequest" },
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
                      name: { kind: "Name", value: "mergeMethod" },
                      value: { kind: "Variable", name: { kind: "Name", value: "mergeMethod" } },
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
                  name: { kind: "Name", value: "pullRequest" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "__typename" } },
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "number" } },
                      { kind: "Field", name: { kind: "Name", value: "state" } },
                      { kind: "Field", name: { kind: "Name", value: "merged" } },
                      { kind: "Field", name: { kind: "Name", value: "mergedAt" } },
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
} as unknown as DocumentNode<PrMergeMutation, PrMergeMutationVariables>

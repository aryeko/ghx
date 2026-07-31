/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never }

import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core"
import type * as Types from "./base-types.js"
export type ProjectV2IssueNodeIdQueryVariables = Exact<{
  url: any
}>

export type ProjectV2IssueNodeIdQuery = {
  __typename: "Query"
  resource:
    | { __typename: "Bot" }
    | { __typename: "CheckRun" }
    | { __typename: "ClosedEvent" }
    | { __typename: "Commit" }
    | { __typename: "ConvertToDraftEvent" }
    | { __typename: "CrossReferencedEvent" }
    | { __typename: "Gist" }
    | { __typename: "Issue"; id: string }
    | { __typename: "Mannequin" }
    | { __typename: "MergedEvent" }
    | { __typename: "Milestone" }
    | { __typename: "Organization" }
    | { __typename: "PullRequest" }
    | { __typename: "PullRequestCommit" }
    | { __typename: "ReadyForReviewEvent" }
    | { __typename: "Release" }
    | { __typename: "Repository" }
    | { __typename: "RepositoryTopic" }
    | { __typename: "ReviewDismissedEvent" }
    | { __typename: "User" }
    | { __typename: "Workflow" }
    | { __typename: "WorkflowRun" }
    | { __typename: "WorkflowRunFile" }
    | null
}

export const ProjectV2IssueNodeIdDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ProjectV2IssueNodeId" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "url" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "URI" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "__typename" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "resource" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "url" },
                value: { kind: "Variable", name: { kind: "Name", value: "url" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
                {
                  kind: "InlineFragment",
                  typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Issue" } },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "__typename" } },
                      { kind: "Field", name: { kind: "Name", value: "id" } },
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
} as unknown as DocumentNode<ProjectV2IssueNodeIdQuery, ProjectV2IssueNodeIdQueryVariables>

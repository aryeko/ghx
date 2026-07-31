/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never }

import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core"
import type * as Types from "./base-types.js"
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
  repositoryOwner:
    | {
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
      }
    | {
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
      }
    | null
}

export const ProjectV2ItemsListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ProjectV2ItemsList" },
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
          variable: { kind: "Variable", name: { kind: "Name", value: "projectNumber" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "first" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "after" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "__typename" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "repositoryOwner" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "login" },
                value: { kind: "Variable", name: { kind: "Name", value: "owner" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
                {
                  kind: "InlineFragment",
                  typeCondition: {
                    kind: "NamedType",
                    name: { kind: "Name", value: "ProjectV2Owner" },
                  },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "__typename" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "projectV2" },
                        arguments: [
                          {
                            kind: "Argument",
                            name: { kind: "Name", value: "number" },
                            value: {
                              kind: "Variable",
                              name: { kind: "Name", value: "projectNumber" },
                            },
                          },
                        ],
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "__typename" } },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "items" },
                              arguments: [
                                {
                                  kind: "Argument",
                                  name: { kind: "Name", value: "first" },
                                  value: {
                                    kind: "Variable",
                                    name: { kind: "Name", value: "first" },
                                  },
                                },
                                {
                                  kind: "Argument",
                                  name: { kind: "Name", value: "after" },
                                  value: {
                                    kind: "Variable",
                                    name: { kind: "Name", value: "after" },
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
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "__typename" },
                                        },
                                        { kind: "Field", name: { kind: "Name", value: "id" } },
                                        { kind: "Field", name: { kind: "Name", value: "type" } },
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "content" },
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
                                                  name: { kind: "Name", value: "Issue" },
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
                                                      name: { kind: "Name", value: "number" },
                                                    },
                                                    {
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "title" },
                                                    },
                                                  ],
                                                },
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
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "number" },
                                                    },
                                                    {
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "title" },
                                                    },
                                                  ],
                                                },
                                              },
                                              {
                                                kind: "InlineFragment",
                                                typeCondition: {
                                                  kind: "NamedType",
                                                  name: { kind: "Name", value: "DraftIssue" },
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
                                                      name: { kind: "Name", value: "title" },
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
                                    kind: "Field",
                                    name: { kind: "Name", value: "pageInfo" },
                                    selectionSet: {
                                      kind: "SelectionSet",
                                      selections: [
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "__typename" },
                                        },
                                        {
                                          kind: "FragmentSpread",
                                          name: { kind: "Name", value: "PageInfoFields" },
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
      name: { kind: "Name", value: "PageInfoFields" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "PageInfo" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "endCursor" } },
          { kind: "Field", name: { kind: "Name", value: "hasNextPage" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ProjectV2ItemsListQuery, ProjectV2ItemsListQueryVariables>

/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never }

import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core"
import type * as Types from "./base-types.js"
/** The type of a project field. */
export type ProjectV2FieldType =
  /** Assignees */
  | "ASSIGNEES"
  /** Date */
  | "DATE"
  /** Issue type */
  | "ISSUE_TYPE"
  /** Iteration */
  | "ITERATION"
  /** Labels */
  | "LABELS"
  /** Linked Pull Requests */
  | "LINKED_PULL_REQUESTS"
  /** Milestone */
  | "MILESTONE"
  /** Number */
  | "NUMBER"
  /** Parent issue */
  | "PARENT_ISSUE"
  /** Repository */
  | "REPOSITORY"
  /** Reviewers */
  | "REVIEWERS"
  /** Single Select */
  | "SINGLE_SELECT"
  /** Sub-issues progress */
  | "SUB_ISSUES_PROGRESS"
  /** Text */
  | "TEXT"
  /** Title */
  | "TITLE"
  /** Tracked by */
  | "TRACKED_BY"
  /** Tracks */
  | "TRACKS"

export type ProjectV2FieldsListQueryVariables = Exact<{
  owner: string
  projectNumber: number
  first: number
  after?: string | null | undefined
}>

export type ProjectV2FieldsListQuery = {
  __typename: "Query"
  repositoryOwner:
    | {
        __typename: "Organization"
        projectV2: {
          __typename: "ProjectV2"
          fields: {
            __typename: "ProjectV2FieldConfigurationConnection"
            nodes: Array<
              | {
                  __typename: "ProjectV2Field"
                  id: string
                  name: string
                  dataType: Types.ProjectV2FieldType
                }
              | {
                  __typename: "ProjectV2IterationField"
                  id: string
                  name: string
                  dataType: Types.ProjectV2FieldType
                }
              | {
                  __typename: "ProjectV2SingleSelectField"
                  id: string
                  name: string
                  dataType: Types.ProjectV2FieldType
                  options: Array<{
                    __typename: "ProjectV2SingleSelectFieldOption"
                    id: string
                    name: string
                  }>
                }
              | null
            > | null
            pageInfo: { __typename: "PageInfo"; endCursor: string | null; hasNextPage: boolean }
          }
        } | null
      }
    | {
        __typename: "User"
        projectV2: {
          __typename: "ProjectV2"
          fields: {
            __typename: "ProjectV2FieldConfigurationConnection"
            nodes: Array<
              | {
                  __typename: "ProjectV2Field"
                  id: string
                  name: string
                  dataType: Types.ProjectV2FieldType
                }
              | {
                  __typename: "ProjectV2IterationField"
                  id: string
                  name: string
                  dataType: Types.ProjectV2FieldType
                }
              | {
                  __typename: "ProjectV2SingleSelectField"
                  id: string
                  name: string
                  dataType: Types.ProjectV2FieldType
                  options: Array<{
                    __typename: "ProjectV2SingleSelectFieldOption"
                    id: string
                    name: string
                  }>
                }
              | null
            > | null
            pageInfo: { __typename: "PageInfo"; endCursor: string | null; hasNextPage: boolean }
          }
        } | null
      }
    | null
}

export const ProjectV2FieldsListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ProjectV2FieldsList" },
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
                              name: { kind: "Name", value: "fields" },
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
                                        {
                                          kind: "InlineFragment",
                                          typeCondition: {
                                            kind: "NamedType",
                                            name: { kind: "Name", value: "ProjectV2Field" },
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
                                                name: { kind: "Name", value: "id" },
                                              },
                                              {
                                                kind: "Field",
                                                name: { kind: "Name", value: "name" },
                                              },
                                              {
                                                kind: "Field",
                                                name: { kind: "Name", value: "dataType" },
                                              },
                                            ],
                                          },
                                        },
                                        {
                                          kind: "InlineFragment",
                                          typeCondition: {
                                            kind: "NamedType",
                                            name: {
                                              kind: "Name",
                                              value: "ProjectV2IterationField",
                                            },
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
                                                name: { kind: "Name", value: "id" },
                                              },
                                              {
                                                kind: "Field",
                                                name: { kind: "Name", value: "name" },
                                              },
                                              {
                                                kind: "Field",
                                                name: { kind: "Name", value: "dataType" },
                                              },
                                            ],
                                          },
                                        },
                                        {
                                          kind: "InlineFragment",
                                          typeCondition: {
                                            kind: "NamedType",
                                            name: {
                                              kind: "Name",
                                              value: "ProjectV2SingleSelectField",
                                            },
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
                                                name: { kind: "Name", value: "id" },
                                              },
                                              {
                                                kind: "Field",
                                                name: { kind: "Name", value: "name" },
                                              },
                                              {
                                                kind: "Field",
                                                name: { kind: "Name", value: "dataType" },
                                              },
                                              {
                                                kind: "Field",
                                                name: { kind: "Name", value: "options" },
                                                selectionSet: {
                                                  kind: "SelectionSet",
                                                  selections: [
                                                    {
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "__typename" },
                                                    },
                                                    {
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "id" },
                                                    },
                                                    {
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "name" },
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
} as unknown as DocumentNode<ProjectV2FieldsListQuery, ProjectV2FieldsListQueryVariables>

/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never }

import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core"
import type * as Types from "./base-types.js"
/** The values that can be used to update a field of an item inside a Project. Only 1 value can be updated at a time. */
export type ProjectV2FieldValue = {
  /** The ISO 8601 date to set on the field. */
  date?: any
  /** The id of the iteration to set on the field. */
  iterationId?: string | null | undefined
  /** The number to set on the field. */
  number?: number | null | undefined
  /** The id of the single select option to set on the field. */
  singleSelectOptionId?: string | null | undefined
  /** The text to set on the field. */
  text?: string | null | undefined
}

export type UpdateProjectV2ItemFieldMutationVariables = Exact<{
  projectId: string | number
  itemId: string | number
  fieldId: string | number
  value: Types.ProjectV2FieldValue
}>

export type UpdateProjectV2ItemFieldMutation = {
  __typename: "Mutation"
  updateProjectV2ItemFieldValue: {
    __typename: "UpdateProjectV2ItemFieldValuePayload"
    projectV2Item: { __typename: "ProjectV2Item"; id: string } | null
  } | null
}

export const UpdateProjectV2ItemFieldDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "UpdateProjectV2ItemField" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "projectId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "itemId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "fieldId" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "value" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ProjectV2FieldValue" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "__typename" } },
          {
            kind: "Field",
            name: { kind: "Name", value: "updateProjectV2ItemFieldValue" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "projectId" },
                      value: { kind: "Variable", name: { kind: "Name", value: "projectId" } },
                    },
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "itemId" },
                      value: { kind: "Variable", name: { kind: "Name", value: "itemId" } },
                    },
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "fieldId" },
                      value: { kind: "Variable", name: { kind: "Name", value: "fieldId" } },
                    },
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "value" },
                      value: { kind: "Variable", name: { kind: "Name", value: "value" } },
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
                  name: { kind: "Name", value: "projectV2Item" },
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
} as unknown as DocumentNode<
  UpdateProjectV2ItemFieldMutation,
  UpdateProjectV2ItemFieldMutationVariables
>

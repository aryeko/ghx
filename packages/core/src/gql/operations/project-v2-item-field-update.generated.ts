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

export const UpdateProjectV2ItemFieldDocument = new TypedDocumentString(`
    mutation UpdateProjectV2ItemField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
  updateProjectV2ItemFieldValue(
    input: {projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value}
  ) {
    projectV2Item {
      id
    }
  }
}
    `)

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
    UpdateProjectV2ItemField(
      variables: UpdateProjectV2ItemFieldMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<UpdateProjectV2ItemFieldMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<UpdateProjectV2ItemFieldMutation>({
            document: UpdateProjectV2ItemFieldDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "UpdateProjectV2ItemField",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

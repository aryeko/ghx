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

export type ProjectV2CommonFields_ProjectV2Field_Fragment = {
  __typename: "ProjectV2Field"
  id: string
  name: string
  dataType: Types.ProjectV2FieldType
}

export type ProjectV2CommonFields_ProjectV2IterationField_Fragment = {
  __typename: "ProjectV2IterationField"
  id: string
  name: string
  dataType: Types.ProjectV2FieldType
}

export type ProjectV2CommonFields_ProjectV2SingleSelectField_Fragment = {
  __typename: "ProjectV2SingleSelectField"
  id: string
  name: string
  dataType: Types.ProjectV2FieldType
}

export type ProjectV2CommonFieldsFragment =
  | ProjectV2CommonFields_ProjectV2Field_Fragment
  | ProjectV2CommonFields_ProjectV2IterationField_Fragment
  | ProjectV2CommonFields_ProjectV2SingleSelectField_Fragment

export type ProjectV2FieldsListOrgQueryVariables = Exact<{
  owner: string
  projectNumber: number
  first: number
  after?: string | null | undefined
}>

export type ProjectV2FieldsListOrgQuery = {
  __typename: "Query"
  organization: {
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
  } | null
}

export const ProjectV2CommonFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment ProjectV2CommonFields on ProjectV2FieldCommon {
  __typename
  id
  name
  dataType
}
    `,
  { fragmentName: "ProjectV2CommonFields" },
)
export const ProjectV2FieldsListOrgDocument = new TypedDocumentString(`
    query ProjectV2FieldsListOrg($owner: String!, $projectNumber: Int!, $first: Int!, $after: String) {
  __typename
  organization(login: $owner) {
    __typename
    projectV2(number: $projectNumber) {
      __typename
      fields(first: $first, after: $after) {
        __typename
        nodes {
          __typename
          ... on ProjectV2FieldCommon {
            __typename
            ...ProjectV2CommonFields
          }
          ... on ProjectV2SingleSelectField {
            __typename
            options {
              __typename
              id
              name
            }
          }
        }
        pageInfo {
          __typename
          ...PageInfoFields
        }
      }
    }
  }
}
    fragment ProjectV2CommonFields on ProjectV2FieldCommon {
  __typename
  id
  name
  dataType
}
fragment PageInfoFields on PageInfo {
  endCursor
  hasNextPage
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
    ProjectV2FieldsListOrg(
      variables: ProjectV2FieldsListOrgQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ProjectV2FieldsListOrgQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ProjectV2FieldsListOrgQuery>({
            document: ProjectV2FieldsListOrgDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ProjectV2FieldsListOrg",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

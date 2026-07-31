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

/** The possible subject types of a pull request review comment. */
export type PullRequestReviewThreadSubjectType =
  /** A comment that has been made against the file of a pull request */
  | "FILE"
  /** A comment that has been made against the line of a pull request */
  | "LINE"

export type PrCommentsListQueryVariables = Exact<{
  owner: string
  name: string
  prNumber: number
  first: number
  after?: string | null | undefined
}>

export type PrCommentsListQuery = {
  __typename: "Query"
  repository: {
    __typename: "Repository"
    pullRequest: {
      __typename: "PullRequest"
      reviewThreads: {
        __typename: "PullRequestReviewThreadConnection"
        edges: Array<{
          __typename: "PullRequestReviewThreadEdge"
          cursor: string
          node: {
            __typename: "PullRequestReviewThread"
            id: string
            path: string
            line: number | null
            startLine: number | null
            diffSide: Types.DiffSide
            subjectType: Types.PullRequestReviewThreadSubjectType
            isResolved: boolean
            isOutdated: boolean
            viewerCanReply: boolean
            viewerCanResolve: boolean
            viewerCanUnresolve: boolean
            resolvedBy: { __typename: "User"; login: string } | null
            comments: {
              __typename: "PullRequestReviewCommentConnection"
              nodes: Array<{
                __typename: "PullRequestReviewComment"
                id: string
                body: string
                createdAt: any
                url: any
                author:
                  | { __typename: "Bot"; login: string }
                  | { __typename: "EnterpriseUserAccount"; login: string }
                  | { __typename: "Mannequin"; login: string }
                  | { __typename: "Organization"; login: string }
                  | { __typename: "User"; login: string }
                  | null
              } | null> | null
            }
          } | null
        } | null> | null
        pageInfo: { __typename: "PageInfo"; endCursor: string | null; hasNextPage: boolean }
      }
    } | null
  } | null
}

export const PrCommentsListDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "PrCommentsList" },
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
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "reviewThreads" },
                        arguments: [
                          {
                            kind: "Argument",
                            name: { kind: "Name", value: "first" },
                            value: { kind: "Variable", name: { kind: "Name", value: "first" } },
                          },
                          {
                            kind: "Argument",
                            name: { kind: "Name", value: "after" },
                            value: { kind: "Variable", name: { kind: "Name", value: "after" } },
                          },
                        ],
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            { kind: "Field", name: { kind: "Name", value: "__typename" } },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "edges" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "__typename" } },
                                  { kind: "Field", name: { kind: "Name", value: "cursor" } },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "node" },
                                    selectionSet: {
                                      kind: "SelectionSet",
                                      selections: [
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "__typename" },
                                        },
                                        { kind: "Field", name: { kind: "Name", value: "id" } },
                                        { kind: "Field", name: { kind: "Name", value: "path" } },
                                        { kind: "Field", name: { kind: "Name", value: "line" } },
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "startLine" },
                                        },
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "diffSide" },
                                        },
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "subjectType" },
                                        },
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "isResolved" },
                                        },
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "isOutdated" },
                                        },
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "viewerCanReply" },
                                        },
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "viewerCanResolve" },
                                        },
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "viewerCanUnresolve" },
                                        },
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "resolvedBy" },
                                          selectionSet: {
                                            kind: "SelectionSet",
                                            selections: [
                                              {
                                                kind: "Field",
                                                name: { kind: "Name", value: "__typename" },
                                              },
                                              {
                                                kind: "Field",
                                                name: { kind: "Name", value: "login" },
                                              },
                                            ],
                                          },
                                        },
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "comments" },
                                          arguments: [
                                            {
                                              kind: "Argument",
                                              name: { kind: "Name", value: "first" },
                                              value: { kind: "IntValue", value: "20" },
                                            },
                                          ],
                                          selectionSet: {
                                            kind: "SelectionSet",
                                            selections: [
                                              {
                                                kind: "Field",
                                                name: { kind: "Name", value: "__typename" },
                                              },
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
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "id" },
                                                    },
                                                    {
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "body" },
                                                    },
                                                    {
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "createdAt" },
                                                    },
                                                    {
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "url" },
                                                    },
                                                    {
                                                      kind: "Field",
                                                      name: { kind: "Name", value: "author" },
                                                      selectionSet: {
                                                        kind: "SelectionSet",
                                                        selections: [
                                                          {
                                                            kind: "Field",
                                                            name: {
                                                              kind: "Name",
                                                              value: "__typename",
                                                            },
                                                          },
                                                          {
                                                            kind: "Field",
                                                            name: { kind: "Name", value: "login" },
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
                              kind: "Field",
                              name: { kind: "Name", value: "pageInfo" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  { kind: "Field", name: { kind: "Name", value: "__typename" } },
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
} as unknown as DocumentNode<PrCommentsListQuery, PrCommentsListQueryVariables>

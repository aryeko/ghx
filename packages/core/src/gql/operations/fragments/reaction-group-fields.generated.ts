/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never }

import { type GraphQLClient, type RequestOptions } from "graphql-request"
import type * as Types from "../base-types.js"
import { TypedDocumentString } from "../typed-document-string.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
/** Emojis that can be attached to Issues, Pull Requests and Comments. */
export type ReactionContent =
  /** Represents the `:confused:` emoji. */
  | "CONFUSED"
  /** Represents the `:eyes:` emoji. */
  | "EYES"
  /** Represents the `:heart:` emoji. */
  | "HEART"
  /** Represents the `:hooray:` emoji. */
  | "HOORAY"
  /** Represents the `:laugh:` emoji. */
  | "LAUGH"
  /** Represents the `:rocket:` emoji. */
  | "ROCKET"
  /** Represents the `:-1:` emoji. */
  | "THUMBS_DOWN"
  /** Represents the `:+1:` emoji. */
  | "THUMBS_UP"

export type ReactionGroupFieldsFragment = {
  __typename: "ReactionGroup"
  content: Types.ReactionContent
  viewerHasReacted: boolean
  reactors: {
    __typename: "ReactorConnection"
    totalCount: number
    nodes: Array<
      | { __typename: "Bot"; login: string }
      | { __typename: "Mannequin"; login: string }
      | { __typename: "Organization"; login: string }
      | { __typename: "User"; login: string }
      | null
    > | null
  }
}

export const ReactionGroupFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment ReactionGroupFields on ReactionGroup {
  __typename
  content
  viewerHasReacted
  reactors(first: 100) {
    __typename
    totalCount
    nodes {
      __typename
      ... on User {
        __typename
        login
      }
      ... on Bot {
        __typename
        login
      }
      ... on Organization {
        __typename
        login
      }
      ... on Mannequin {
        __typename
        login
      }
    }
  }
}
    `,
  { fragmentName: "ReactionGroupFields" },
)

export type SdkFunctionWrapper = <T>(
  action: (requestHeaders?: Record<string, string>) => Promise<T>,
  operationName: string,
  operationType?: string,
  variables?: any,
) => Promise<T>

const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) =>
  action()

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {}
}
export type Sdk = ReturnType<typeof getSdk>

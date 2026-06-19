import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../base-types.js"
import { TypedDocumentString } from "../typed-document-string.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type ReactionGroupFieldsFragment = {
  __typename?: "ReactionGroup"
  content: Types.ReactionContent
  viewerHasReacted: boolean
  reactors: {
    __typename?: "ReactorConnection"
    totalCount: number
    nodes?: Array<
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
  content
  viewerHasReacted
  reactors(first: 100) {
    totalCount
    nodes {
      __typename
      ... on User {
        login
      }
      ... on Bot {
        login
      }
      ... on Organization {
        login
      }
      ... on Mannequin {
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

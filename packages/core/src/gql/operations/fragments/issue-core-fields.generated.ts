/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never }

import { type GraphQLClient, type RequestOptions } from "graphql-request"
import type * as Types from "../base-types.js"
import { TypedDocumentString } from "../typed-document-string.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
/** The possible states of an issue. */
export type IssueState =
  /** An issue that has been closed */
  | "CLOSED"
  /** An issue that is still open */
  | "OPEN"

export type IssueCoreFieldsFragment = {
  __typename: "Issue"
  id: string
  number: number
  title: string
  state: Types.IssueState
  url: any
}

export const IssueCoreFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment IssueCoreFields on Issue {
  id
  number
  title
  state
  url
}
    `,
  { fragmentName: "IssueCoreFields" },
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

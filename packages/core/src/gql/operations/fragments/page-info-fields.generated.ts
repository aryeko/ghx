import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../base-types.js"
import { TypedDocumentString } from "../typed-document-string.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PageInfoFieldsFragment = {
  __typename?: "PageInfo"
  endCursor?: string | null
  hasNextPage: boolean
}

export const PageInfoFieldsFragmentDoc = new TypedDocumentString(
  `
    fragment PageInfoFields on PageInfo {
  endCursor
  hasNextPage
}
    `,
  { fragmentName: "PageInfoFields" },
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

import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"
import { TypedDocumentString } from "./typed-document-string.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrAssigneesLookupByNumberQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  prNumber: Types.Scalars["Int"]["input"]
  assignableUsersAfter?: Types.InputMaybe<Types.Scalars["String"]["input"]>
}>

export type PrAssigneesLookupByNumberQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    pullRequest?: { __typename?: "PullRequest"; id: string } | null
    assignableUsers: {
      __typename?: "UserConnection"
      pageInfo: { __typename?: "PageInfo"; hasNextPage: boolean; endCursor?: string | null }
      nodes?: Array<{ __typename?: "User"; id: string; login: string } | null> | null
    }
  } | null
}

export const PrAssigneesLookupByNumberDocument = new TypedDocumentString(`
    query PrAssigneesLookupByNumber($owner: String!, $name: String!, $prNumber: Int!, $assignableUsersAfter: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $prNumber) {
      id
    }
    assignableUsers(first: 100, after: $assignableUsersAfter) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        login
      }
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
    PrAssigneesLookupByNumber(
      variables: PrAssigneesLookupByNumberQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrAssigneesLookupByNumberQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrAssigneesLookupByNumberQuery>({
            document: PrAssigneesLookupByNumberDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrAssigneesLookupByNumber",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

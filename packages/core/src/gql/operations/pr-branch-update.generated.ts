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
/** The possible methods for updating a pull request's head branch with the base branch. */
export type PullRequestBranchUpdateMethod =
  /** Update branch via merge */
  | "MERGE"
  /** Update branch via rebase */
  | "REBASE"

export type PrBranchUpdateMutationVariables = Exact<{
  pullRequestId: string | number
  updateMethod?: Types.PullRequestBranchUpdateMethod | null | undefined
}>

export type PrBranchUpdateMutation = {
  __typename: "Mutation"
  updatePullRequestBranch: {
    __typename: "UpdatePullRequestBranchPayload"
    pullRequest: { __typename: "PullRequest"; id: string; number: number } | null
  } | null
}

export const PrBranchUpdateDocument = new TypedDocumentString(`
    mutation PrBranchUpdate($pullRequestId: ID!, $updateMethod: PullRequestBranchUpdateMethod) {
  updatePullRequestBranch(
    input: {pullRequestId: $pullRequestId, updateMethod: $updateMethod}
  ) {
    pullRequest {
      id
      number
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
    PrBranchUpdate(
      variables: PrBranchUpdateMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrBranchUpdateMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrBranchUpdateMutation>({
            document: PrBranchUpdateDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrBranchUpdate",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

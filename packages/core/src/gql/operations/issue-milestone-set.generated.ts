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
export type IssueMilestoneSetMutationVariables = Exact<{
  issueId: string | number
  milestoneId?: string | number | null | undefined
}>

export type IssueMilestoneSetMutation = {
  __typename: "Mutation"
  updateIssue: {
    __typename: "UpdateIssuePayload"
    issue: {
      __typename: "Issue"
      id: string
      milestone: { __typename: "Milestone"; number: number } | null
    } | null
  } | null
}

export const IssueMilestoneSetDocument = new TypedDocumentString(`
    mutation IssueMilestoneSet($issueId: ID!, $milestoneId: ID) {
  updateIssue(input: {id: $issueId, milestoneId: $milestoneId}) {
    issue {
      id
      milestone {
        number
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
    IssueMilestoneSet(
      variables: IssueMilestoneSetMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueMilestoneSetMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueMilestoneSetMutation>({
            document: IssueMilestoneSetDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueMilestoneSet",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

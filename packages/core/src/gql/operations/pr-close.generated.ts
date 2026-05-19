import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"
import { TypedDocumentString } from "./typed-document-string.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrCloseMutationVariables = Types.Exact<{
  pullRequestId: Types.Scalars["ID"]["input"]
  addComment?: Types.Scalars["Boolean"]["input"]
  commentBody?: Types.Scalars["String"]["input"]
}>

export type PrCloseMutation = {
  __typename?: "Mutation"
  closePullRequest?: {
    __typename?: "ClosePullRequestPayload"
    pullRequest?: {
      __typename?: "PullRequest"
      id: string
      number: number
      state: Types.PullRequestState
      closed: boolean
    } | null
  } | null
  addComment?: {
    __typename?: "AddCommentPayload"
    commentEdge?: {
      __typename?: "IssueCommentEdge"
      node?: { __typename?: "IssueComment"; id: string } | null
    } | null
  } | null
}

export const PrCloseDocument = new TypedDocumentString(`
    mutation PrClose($pullRequestId: ID!, $addComment: Boolean! = false, $commentBody: String! = "") {
  closePullRequest(input: {pullRequestId: $pullRequestId}) {
    pullRequest {
      id
      number
      state
      closed
    }
  }
  addComment(input: {subjectId: $pullRequestId, body: $commentBody}) @include(if: $addComment) {
    commentEdge {
      node {
        id
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
    PrClose(
      variables: PrCloseMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrCloseMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrCloseMutation>({
            document: PrCloseDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrClose",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

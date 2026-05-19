import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"
import { TypedDocumentString } from "./typed-document-string.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrCloseMutationVariables = Types.Exact<{
  pullRequestId: Types.Scalars["ID"]["input"]
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
}

export const PrCloseDocument = new TypedDocumentString(`
    mutation PrClose($pullRequestId: ID!) {
  closePullRequest(input: {pullRequestId: $pullRequestId}) {
    pullRequest {
      id
      number
      state
      closed
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

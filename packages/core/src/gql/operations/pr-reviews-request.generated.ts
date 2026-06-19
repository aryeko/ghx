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
export type PrReviewsRequestMutationVariables = Exact<{
  pullRequestId: string | number
  userIds: Array<string | number> | string | number
  reviewRequestsFirst?: number | null | undefined
}>

export type PrReviewsRequestMutation = {
  __typename: "Mutation"
  requestReviews: {
    __typename: "RequestReviewsPayload"
    pullRequest: {
      __typename: "PullRequest"
      id: string
      number: number
      reviewRequests: {
        __typename: "ReviewRequestConnection"
        nodes: Array<{
          __typename: "ReviewRequest"
          requestedReviewer:
            | { __typename: "Bot" }
            | { __typename: "Mannequin" }
            | { __typename: "Team"; slug: string }
            | { __typename: "User"; login: string }
            | null
        } | null> | null
      } | null
    } | null
  } | null
}

export const PrReviewsRequestDocument = new TypedDocumentString(`
    mutation PrReviewsRequest($pullRequestId: ID!, $userIds: [ID!]!, $reviewRequestsFirst: Int = 100) {
  __typename
  requestReviews(input: {pullRequestId: $pullRequestId, userIds: $userIds}) {
    __typename
    pullRequest {
      __typename
      id
      number
      reviewRequests(first: $reviewRequestsFirst) {
        __typename
        nodes {
          __typename
          requestedReviewer {
            __typename
            ... on User {
              __typename
              login
            }
            ... on Team {
              __typename
              slug
            }
          }
        }
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
    PrReviewsRequest(
      variables: PrReviewsRequestMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrReviewsRequestMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrReviewsRequestMutation>({
            document: PrReviewsRequestDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrReviewsRequest",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>

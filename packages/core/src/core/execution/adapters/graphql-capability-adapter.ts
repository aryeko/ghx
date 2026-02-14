import type {
  GithubClient,
  IssueCommentsListInput,
  IssueListInput,
  IssueViewInput,
  PrCommentsListInput,
  PrDiffListFilesInput,
  PrListInput,
  PrReviewsListInput,
  PrViewInput,
  RepoViewInput
} from "../../../gql/client.js"
import { errorCodes } from "../../errors/codes.js"
import { mapErrorToCode } from "../../errors/map-error.js"
import { isRetryableErrorCode } from "../../errors/retryability.js"
import { normalizeError, normalizeResult } from "../normalizer.js"
import type { ResultEnvelope } from "../../contracts/envelope.js"

export type GraphqlCapabilityId =
  | "repo.view"
  | "issue.view"
  | "issue.list"
  | "issue.comments.list"
  | "pr.view"
  | "pr.list"
  | "pr.comments.list"
  | "pr.reviews.list"
  | "pr.diff.list_files"
  | "pr.comment.reply"
  | "pr.comment.resolve"
  | "pr.comment.unresolve"

const DEFAULT_LIST_FIRST = 30

function withDefaultFirst(params: Record<string, unknown>): Record<string, unknown> {
  if (params.first === undefined) {
    return {
      ...params,
      first: DEFAULT_LIST_FIRST
    }
  }

  return params
}

export async function runGraphqlCapability(
  client: Pick<
    GithubClient,
    "fetchRepoView" | "fetchIssueView" | "fetchIssueList" | "fetchIssueCommentsList" | "fetchPrView" | "fetchPrList"
      | "fetchPrCommentsList" | "fetchPrReviewsList" | "fetchPrDiffListFiles" | "replyToReviewThread"
      | "resolveReviewThread" | "unresolveReviewThread"
  >,
  capabilityId: GraphqlCapabilityId,
  params: Record<string, unknown>
): Promise<ResultEnvelope> {
  try {
    if (capabilityId === "repo.view") {
      const data = await client.fetchRepoView(params as RepoViewInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.view") {
      const data = await client.fetchIssueView(params as IssueViewInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.list") {
      const data = await client.fetchIssueList(withDefaultFirst(params) as IssueListInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.comments.list") {
      const data = await client.fetchIssueCommentsList(params as IssueCommentsListInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.view") {
      const data = await client.fetchPrView(params as PrViewInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.list") {
      const data = await client.fetchPrList(withDefaultFirst(params) as PrListInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.comments.list") {
      const data = await client.fetchPrCommentsList(withDefaultFirst(params) as PrCommentsListInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.reviews.list") {
      const data = await client.fetchPrReviewsList(withDefaultFirst(params) as PrReviewsListInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.diff.list_files") {
      const data = await client.fetchPrDiffListFiles(withDefaultFirst(params) as PrDiffListFilesInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.comment.reply") {
      const threadId = typeof params.threadId === "string" ? params.threadId : ""
      const body = typeof params.body === "string" ? params.body : ""
      const data = await client.replyToReviewThread({ threadId, body })
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.comment.resolve") {
      const threadId = typeof params.threadId === "string" ? params.threadId : ""
      const data = await client.resolveReviewThread({ threadId })
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.comment.unresolve") {
      const threadId = typeof params.threadId === "string" ? params.threadId : ""
      const data = await client.unresolveReviewThread({ threadId })
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    return normalizeError(
      {
        code: errorCodes.Validation,
        message: `Unsupported GraphQL capability: ${capabilityId}`,
        retryable: false
      },
      "graphql",
      { capabilityId, reason: "CAPABILITY_LIMIT" }
    )
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code)
      },
      "graphql",
      { capabilityId, reason: "CARD_PREFERRED" }
    )
  }
}

import { errorCodes } from "@core/core/errors/codes.js"
import { githubRequestId, type RestClient, RestError, unknownRestWrite } from "../rest-adapter.js"
import { readStack } from "./read-stack.js"
import {
  isMergeRequestId,
  type MergeAction,
  type MergeMethod,
  parseMergeResult,
  responseMergeRequestId,
} from "./stack-merge-result.js"

type RepoInput = { owner: string; name: string }

type StackMergeInput = RepoInput & {
  stackNumber: number
  throughPrNumber: number
  expectedBaseRefName: string
  expectedMembers: readonly { prNumber: number; headSha: string }[]
  mergeAction?: MergeAction
  method?: MergeMethod
}

type MergeRequestInput = RepoInput & { prNumber: number; requestId: string }

function rejectMergeInput(message: string, details?: Record<string, unknown>): never {
  throw new RestError({
    code: errorCodes.Validation,
    message,
    retryable: false,
    ...(details === undefined ? {} : { details }),
  })
}

export async function mergeStack(client: RestClient, repoPath: string, input: StackMergeInput) {
  const { owner, name, stackNumber, throughPrNumber, expectedBaseRefName, expectedMembers } = input
  const { mergeAction = "default", method } = input
  const identifiers = { owner, name, stackNumber, throughPrNumber }
  if (method !== undefined && mergeAction !== "direct_merge") {
    rejectMergeInput("Set mergeAction to direct_merge when supplying method.")
  }

  const stack = await readStack(client.read, repoPath, stackNumber)
  if (stack.baseRefName !== expectedBaseRefName) {
    rejectMergeInput("Stack target branch changed. Refresh the merge preview.", identifiers)
  }
  const target = stack.members.find((member) => member.prNumber === throughPrNumber)
  if (!stack.open || target?.state !== "OPEN") {
    rejectMergeInput("throughPrNumber must select an open PR in this stack", identifiers)
  }
  const prefix = stack.members.slice(0, target.position)
  const closed = prefix.find((member) => member.state === "CLOSED")
  if (closed !== undefined) {
    rejectMergeInput("A downstack PR was closed without merging.", {
      ...identifiers,
      closedPrNumber: closed.prNumber,
    })
  }
  const open = prefix.filter((member) => member.state === "OPEN")
  if (
    open.length !== expectedMembers.length ||
    open.some(({ prNumber, headSha }, index) => {
      const expected = expectedMembers[index]
      return (
        expected?.prNumber !== prNumber || expected.headSha.toLowerCase() !== headSha.toLowerCase()
      )
    })
  ) {
    rejectMergeInput(
      "Open stack members or their heads changed. Refresh the merge preview.",
      identifiers,
    )
  }
  const previewPrNumbers = open.map(({ prNumber }) => prNumber)
  const submission = { ...identifiers, prNumbers: previewPrNumbers }

  const { status, data, headers } = await client
    .request(`${repoPath}/pulls/${throughPrNumber}/merge-async`, {
      method: "PUT",
      expectedStatuses: [200, 202, 409],
      body: {
        sha: target.headSha,
        merge_action: mergeAction,
        ...(method === undefined ? {} : { merge_method: method }),
      },
    })
    .catch((error: unknown) => {
      if (error instanceof RestError) {
        const details = error.result.details
        if (details?.submissionOutcome !== "unknown") throw error
        const { status, githubRequestId } = details
        throw unknownRestWrite({
          ...submission,
          ...(typeof status === "number" ? { status } : {}),
          ...(typeof githubRequestId === "string" ? { githubRequestId } : {}),
        })
      }
      throw unknownRestWrite(submission)
    })

  const requestId = responseMergeRequestId(data)
  const httpRequestId = githubRequestId(headers)
  const responseDetails = {
    ...submission,
    status,
    ...(requestId === undefined ? {} : { requestId }),
    ...(httpRequestId === undefined ? {} : { githubRequestId: httpRequestId }),
  }
  if (status === 409) {
    rejectMergeInput(
      requestId === undefined
        ? "GitHub reported a merge request conflict. Check the stack and PR state before submitting again."
        : "A merge request is already pending for this PR. Inspect it with pr.merge.request.view. Its merge scope is unverified.",
      responseDetails,
    )
  }

  const result = parseMergeResult(data)
  if (
    status === 202 &&
    result?.status === "pending" &&
    result.expectedHeadSha.toLowerCase() === target.headSha.toLowerCase()
  ) {
    return { ...result, previewPrNumbers }
  }
  if (status === 200 && (result?.status === "merged" || result?.status === "enqueued")) {
    return { ...result, previewPrNumbers }
  }
  throw unknownRestWrite(responseDetails)
}

export async function readMergeRequest(
  client: RestClient,
  repoPath: string,
  input: MergeRequestInput,
) {
  const { owner, name, prNumber, requestId } = input
  if (!isMergeRequestId(requestId)) rejectMergeInput("requestId must be a merge request UUID")
  const details = { owner, name, prNumber, requestId }
  const path = `${repoPath}/pulls/${prNumber}/merge-async/${requestId}`
  const { data } = await client.read(path).catch((error: unknown) => {
    if (error instanceof RestError && error.result.details?.status === 404) {
      throw new RestError({
        code: errorCodes.NotFound,
        message:
          "Merge request missing or expired. GitHub keeps results for 24 hours after their most recent update. Inspect the PR with pr.view.",
        retryable: false,
        details: { ...details, status: 404 },
      })
    }
    throw error
  })
  const result = parseMergeResult(data)
  if (
    result === null ||
    (result.requestId !== undefined && result.requestId.toLowerCase() !== requestId.toLowerCase())
  ) {
    throw new RestError({
      code: errorCodes.Server,
      message: "GitHub returned an invalid asynchronous merge result",
      retryable: false,
      details,
    })
  }
  return { ...result, requestId }
}

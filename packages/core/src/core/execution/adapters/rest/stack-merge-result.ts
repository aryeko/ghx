import { isObject } from "@core/shared/utils.js"
import { containsSensitiveText } from "../cli/helpers.js"

export type MergeAction = "default" | "direct_merge" | "merge_queue"
export type MergeMethod = "merge" | "squash" | "rebase"

const UUID = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i
const SHA = /^[\da-f]{40}$/i

export function isMergeRequestId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value)
}

function isSha(value: unknown): value is string {
  return typeof value === "string" && SHA.test(value)
}

function isMergeAction(value: unknown): value is MergeAction {
  return value === "default" || value === "direct_merge" || value === "merge_queue"
}

function isMergeMethod(value: unknown): value is MergeMethod | "default" {
  return value === "default" || value === "merge" || value === "squash" || value === "rebase"
}

function detailsOf(data: unknown): Record<string, unknown> | undefined {
  if (isObject(data) && isObject(data.details)) return data.details
}

export function responseMergeRequestId(data: unknown): string | undefined {
  const uuid = detailsOf(data)?.uuid
  return isMergeRequestId(uuid) ? uuid : undefined
}

export function parseMergeResult(data: unknown) {
  const details = detailsOf(data)
  if (!isObject(data) || details === undefined) return null

  const requestId = responseMergeRequestId(data)
  if (details.uuid !== undefined && requestId === undefined) return null
  const fields = {
    ...(requestId === undefined ? {} : { requestId }),
    ...(typeof details.message === "string" && !containsSensitiveText(details.message)
      ? { message: details.message }
      : {}),
  }

  switch (data.status) {
    case "pending":
      if (
        requestId === undefined ||
        !isMergeMethod(details.merge_method) ||
        !isMergeAction(details.merge_action) ||
        !isSha(details.expected_head_sha)
      ) {
        return null
      }
      return {
        ...fields,
        status: data.status,
        requestId,
        method: details.merge_method,
        mergeAction: details.merge_action,
        expectedHeadSha: details.expected_head_sha,
        ...(typeof details.bypass_rules === "boolean" ? { bypassRules: details.bypass_rules } : {}),
      }
    case "merged":
      if (!isSha(details.sha)) return null
      return { ...fields, status: data.status, mergeCommitSha: details.sha }
    case "enqueued":
    case "failed":
      return { ...fields, status: data.status }
    default:
      return null
  }
}

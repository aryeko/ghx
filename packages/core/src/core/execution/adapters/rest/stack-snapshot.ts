import { errorCodes } from "@core/core/errors/codes.js"
import { isObject } from "@core/shared/utils.js"
import { RestError } from "../rest-adapter.js"

export function invalidStackResponse(): never {
  throw new RestError({
    code: errorCodes.Server,
    message: "GitHub returned an invalid stack response",
    retryable: false,
  })
}

function record(value: unknown): Record<string, unknown> {
  if (!isObject(value)) return invalidStackResponse()
  return value
}

function positiveInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    return invalidStackResponse()
  }
  return value
}

function nonEmptyString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return invalidStackResponse()
  return value
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") return invalidStackResponse()
  return value
}

function parseSummary(value: unknown) {
  const stack = record(value)
  if (!Array.isArray(stack.pull_requests) || stack.pull_requests.length === 0) {
    return invalidStackResponse()
  }
  const pullRequests = stack.pull_requests.map(record)
  const prNumbers = pullRequests.map((pr) => positiveInteger(pr.number))
  if (new Set(prNumbers).size !== prNumbers.length) return invalidStackResponse()

  return {
    stackNumber: positiveInteger(stack.number),
    baseRefName: nonEmptyString(record(stack.base).ref),
    open: boolean(stack.open),
    prNumbers,
    pullRequests,
  }
}

export function parseStackList(value: unknown) {
  if (!Array.isArray(value)) return invalidStackResponse()
  return value.map((entry) => {
    const { stackNumber, baseRefName, open, prNumbers } = parseSummary(entry)
    return { stackNumber, baseRefName, open, prNumbers }
  })
}

function parseState(pr: Record<string, unknown>): "OPEN" | "CLOSED" | "MERGED" {
  if (pr.state === "open" && pr.merged_at === null) return "OPEN"
  if (pr.state === "closed") {
    if (pr.merged_at === null) return "CLOSED"
    if (typeof pr.merged_at === "string" && pr.merged_at.length > 0) return "MERGED"
  }
  return invalidStackResponse()
}

export function parseStackSnapshot(value: unknown, expectedNumber: number) {
  const { stackNumber, baseRefName, open, pullRequests } = parseSummary(value)
  if (stackNumber !== expectedNumber) return invalidStackResponse()
  return {
    stackNumber,
    baseRefName,
    open,
    members: pullRequests.map((pr, index) => {
      const head = record(pr.head)
      const headSha = nonEmptyString(head.sha)
      if (!/^[a-f\d]{40}$/i.test(headSha)) return invalidStackResponse()
      return {
        prNumber: positiveInteger(pr.number),
        position: index + 1,
        headRefName: nonEmptyString(head.ref),
        headSha,
        baseRefName: nonEmptyString(record(pr.base).ref),
        state: parseState(pr),
        isDraft: boolean(pr.draft),
        nodeId: nonEmptyString(pr.node_id),
      }
    }),
  }
}

export type StackSnapshot = ReturnType<typeof parseStackSnapshot>

export function publicStackSnapshot(snapshot: StackSnapshot) {
  const { stackNumber, baseRefName, open } = snapshot
  return {
    stackNumber,
    baseRefName,
    open,
    members: snapshot.members.map(({ nodeId: _nodeId, ...member }) => member),
  }
}

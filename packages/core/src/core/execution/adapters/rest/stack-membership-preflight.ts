import { errorCodes } from "@core/core/errors/codes.js"
import { isObject } from "@core/shared/utils.js"
import { RestError, type RestReader } from "../rest-adapter.js"
import { nextStackPage } from "./stack-pagination.js"
import { invalidStackResponse, parseStackList } from "./stack-snapshot.js"

const PR_READ_BATCH_SIZE = 4

export function membershipValidation(message: string, details?: Record<string, unknown>): never {
  throw new RestError({
    code: errorCodes.Validation,
    message,
    retryable: false,
    ...(details === undefined ? {} : { details }),
  })
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

export function validatePrNumbers(prNumbers: readonly number[], field: string, minimum: number) {
  if (
    prNumbers.length < minimum ||
    !prNumbers.every(isPositiveInteger) ||
    new Set(prNumbers).size !== prNumbers.length
  ) {
    membershipValidation(`${field} must contain at least ${minimum} distinct positive PR numbers`)
  }
}

function invalidPullResponse(prNumber: number): never {
  throw new RestError({
    code: errorCodes.Server,
    message: "GitHub returned an invalid pull request response",
    retryable: false,
    details: { prNumber },
  })
}

function readBranch(value: unknown, prNumber: number) {
  if (!isObject(value) || typeof value.ref !== "string" || value.ref.length === 0) {
    return invalidPullResponse(prNumber)
  }
  if (value.repo === null) {
    return membershipValidation("The PR head and base must belong to the target repository", {
      prNumber,
    })
  }
  if (
    !isObject(value.repo) ||
    !isPositiveInteger(value.repo.id) ||
    typeof value.repo.full_name !== "string" ||
    value.repo.full_name.length === 0
  ) {
    return invalidPullResponse(prNumber)
  }
  return {
    ref: value.ref,
    repoId: value.repo.id,
    fullName: value.repo.full_name.toLowerCase(),
  }
}

async function requireStandalone(read: RestReader, repoPath: string, prNumber: number) {
  const search = new URLSearchParams({ pull_request: String(prNumber) })
  const { data, headers } = await read(`${repoPath}/stacks`, search)
  const matches = parseStackList(data)
  const [match] = matches
  if (
    nextStackPage(headers.get("link"), 1) !== null ||
    matches.length > 1 ||
    (match !== undefined && !match.prNumbers.includes(prNumber))
  ) {
    return invalidStackResponse()
  }
  if (match !== undefined) {
    membershipValidation("The PR already belongs to a stack", {
      prNumber,
      stackNumber: match.stackNumber,
    })
  }
}

async function readCandidate(read: RestReader, repoPath: string, repo: string, prNumber: number) {
  const { data } = await read(`${repoPath}/pulls/${prNumber}`)
  if (
    !isObject(data) ||
    data.number !== prNumber ||
    (data.state !== "open" && data.state !== "closed")
  ) {
    return invalidPullResponse(prNumber)
  }
  if (data.state !== "open")
    membershipValidation("Only open PRs can be linked to a stack", { prNumber })

  const base = readBranch(data.base, prNumber)
  const head = readBranch(data.head, prNumber)
  if (head.repoId !== base.repoId || base.fullName !== repo || head.fullName !== repo) {
    membershipValidation("The PR head and base must belong to the target repository", { prNumber })
  }
  await requireStandalone(read, repoPath, prNumber)
  return { prNumber, baseRefName: base.ref, headRefName: head.ref, repoId: base.repoId }
}

type Candidate = Awaited<ReturnType<typeof readCandidate>>

export async function readCandidates(
  read: RestReader,
  repoPath: string,
  repo: string,
  prNumbers: readonly number[],
) {
  const target = repo.toLowerCase()
  const candidates: Candidate[] = []
  for (let i = 0; i < prNumbers.length; i += PR_READ_BATCH_SIZE) {
    const batch = prNumbers.slice(i, i + PR_READ_BATCH_SIZE)
    candidates.push(
      ...(await Promise.all(batch.map((pr) => readCandidate(read, repoPath, target, pr)))),
    )
  }
  return candidates
}

export function validateChain(
  candidates: readonly Candidate[],
  lowerLayer?: { prNumber: number; headRefName: string },
  stackRefs: readonly string[] = [],
) {
  const first = candidates[0]
  if (first === undefined) return
  const usedRefs = new Set([...stackRefs, lowerLayer?.headRefName ?? first.baseRefName])
  let previous = lowerLayer
  for (const candidate of candidates) {
    if (candidate.repoId !== first.repoId) {
      membershipValidation("The PRs must belong to the same target repository", {
        prNumber: candidate.prNumber,
      })
    }
    if (previous !== undefined && previous.headRefName !== candidate.baseRefName) {
      membershipValidation("Each PR base must match the previous PR head in bottom-to-top order", {
        prNumber: candidate.prNumber,
        previousPrNumber: previous.prNumber,
      })
    }
    if (usedRefs.has(candidate.headRefName)) {
      membershipValidation("A stack cannot revisit a branch in its PR chain", {
        prNumber: candidate.prNumber,
      })
    }
    usedRefs.add(candidate.headRefName)
    previous = candidate
  }
}

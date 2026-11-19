import { errorCodes } from "@core/core/errors/codes.js"
import { isObject } from "@core/shared/utils.js"
import { githubRequestId, type RestClient, RestError, unknownRestWrite } from "../rest-adapter.js"
import { readStack } from "./read-stack.js"
import {
  isPositiveInteger,
  membershipValidation,
  readCandidates,
  validateChain,
  validatePrNumbers,
} from "./stack-membership-preflight.js"
import { nextStackPage } from "./stack-pagination.js"
import { invalidStackResponse, parseStackSnapshot, publicStackSnapshot } from "./stack-snapshot.js"

type RepoInput = { owner: string; name: string }
type CreateInput = RepoInput & { prNumbers: readonly number[] }
type AddInput = CreateInput & { stackNumber: number; expectedTopPrNumber: number }
type UnstackInput = RepoInput & { stackNumber: number; expectedPrNumbers: readonly number[] }
type WriteScope = {
  repo: string
  prNumbers: readonly number[]
  stackNumber?: number
  expectedTopPrNumber?: number
  expectedPrNumbers?: readonly number[]
}

async function submitMembership(
  client: RestClient,
  path: string,
  expectedStatuses: readonly number[],
  scope: WriteScope,
  body?: { pull_requests: readonly number[] },
) {
  try {
    return await client.request(path, {
      method: "POST",
      expectedStatuses,
      ...(body === undefined ? {} : { body }),
    })
  } catch (error) {
    if (!(error instanceof RestError)) throw unknownRestWrite(scope)
    const { result } = error
    const details = { ...result.details, ...scope }
    if (result.details?.submissionOutcome === "unknown") throw unknownRestWrite(details)
    if (result.details?.status === 409) {
      throw new RestError({
        code: errorCodes.Validation,
        message: "GitHub reported a stack conflict. Refresh membership before submitting again.",
        retryable: false,
        details,
      })
    }
    throw error
  }
}

function parseWrittenStack(
  response: Awaited<ReturnType<RestClient["request"]>>,
  scope: WriteScope,
) {
  const { data, status, headers } = response
  const observedNumber = isObject(data) && isPositiveInteger(data.number) ? data.number : undefined
  const stackNumber = scope.stackNumber ?? observedNumber
  try {
    if (stackNumber === undefined || nextStackPage(headers.get("link"), 1) !== null) {
      return invalidStackResponse()
    }
    return publicStackSnapshot(parseStackSnapshot(data, stackNumber))
  } catch {
    const requestId = githubRequestId(headers)
    throw unknownRestWrite({
      ...scope,
      status,
      ...(stackNumber === undefined ? {} : { stackNumber }),
      ...(requestId === undefined ? {} : { githubRequestId: requestId }),
    })
  }
}

export async function createStack(client: RestClient, repoPath: string, input: CreateInput) {
  const { owner, name } = input
  const prNumbers = [...input.prNumbers]
  const repo = `${owner}/${name}`
  validatePrNumbers(prNumbers, "prNumbers", 2)
  validateChain(await readCandidates(client.read, repoPath, repo, prNumbers))

  const scope = { repo, prNumbers }
  const response = await submitMembership(client, `${repoPath}/stacks`, [201], scope, {
    pull_requests: prNumbers,
  })
  return parseWrittenStack(response, scope)
}

export async function addToStack(client: RestClient, repoPath: string, input: AddInput) {
  const { owner, name, stackNumber, expectedTopPrNumber } = input
  const prNumbers = [...input.prNumbers]
  const repo = `${owner}/${name}`
  validatePrNumbers(prNumbers, "prNumbers", 1)
  const candidates = await readCandidates(client.read, repoPath, repo, prNumbers)
  const stack = await readStack(client.read, repoPath, stackNumber)
  const top = stack.members.at(-1)
  if (top === undefined) return invalidStackResponse()
  if (top.prNumber !== expectedTopPrNumber) {
    membershipValidation("Stack top changed. Refresh membership before appending PRs.", {
      repo,
      stackNumber,
      expectedTopPrNumber,
      actualTopPrNumber: top.prNumber,
    })
  }
  if (!stack.open)
    membershipValidation("PRs can only be appended to an open stack", { stackNumber })

  const existingPrNumbers = stack.members.map(({ prNumber }) => prNumber)
  const existing = new Set(existingPrNumbers)
  if (prNumbers.some((prNumber) => existing.has(prNumber))) {
    membershipValidation("A PR to append already belongs to the target stack", { stackNumber })
  }
  validateChain(candidates, top, [
    stack.baseRefName,
    ...stack.members.map(({ headRefName }) => headRefName),
  ])

  const scope = {
    repo,
    stackNumber,
    expectedTopPrNumber,
    prNumbers,
    expectedPrNumbers: [...existingPrNumbers, ...prNumbers],
  }
  const response = await submitMembership(
    client,
    `${repoPath}/stacks/${stackNumber}/add`,
    [200],
    scope,
    {
      pull_requests: prNumbers,
    },
  )
  return parseWrittenStack(response, scope)
}

export async function unstack(client: RestClient, repoPath: string, input: UnstackInput) {
  const { owner, name, stackNumber } = input
  const prNumbers = [...input.expectedPrNumbers]
  const repo = `${owner}/${name}`
  validatePrNumbers(prNumbers, "expectedPrNumbers", 1)
  const current = await readStack(client.read, repoPath, stackNumber)
  const actualPrNumbers = current.members.map(({ prNumber }) => prNumber)
  if (
    actualPrNumbers.length !== prNumbers.length ||
    actualPrNumbers.some((number, index) => number !== prNumbers[index])
  ) {
    membershipValidation("Stack membership changed. Refresh membership before unstacking.", {
      repo,
      stackNumber,
      expectedPrNumbers: prNumbers,
      actualPrNumbers,
    })
  }

  const scope = { repo, stackNumber, prNumbers }
  const response = await submitMembership(
    client,
    `${repoPath}/stacks/${stackNumber}/unstack`,
    [200, 204],
    scope,
  )
  if (response.status === 204) return { dissolved: true, remainingPrNumbers: [] }

  const stack = parseWrittenStack(response, scope)
  return {
    dissolved: false,
    remainingPrNumbers: stack.members.map(({ prNumber }) => prNumber),
    stack,
  }
}

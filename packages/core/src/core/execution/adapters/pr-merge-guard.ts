import type { ResultError } from "@core/core/contracts/envelope.js"
import { errorCodes } from "@core/core/errors/codes.js"
import { mapErrorToCode } from "@core/core/errors/map-error.js"
import type { GraphqlClient } from "@core/gql/transport.js"
import { DEFAULT_TIMEOUT_MS, sanitizeCliErrorMessage } from "./cli/helpers.js"
import type { CliCommandRunner } from "./cli-adapter.js"

const STACK_FIELDS = "url stack { number }"
const UNDEFINED_STACK_FIELD = "Field 'stack' doesn't exist on type 'PullRequest'"

type MergeTarget = { owner: string; name: string; prNumber: number }
type MembershipResult = { ok: true; repo: string } | { ok: false; error: ResultError }
type ReadMembership = (query: string) => Promise<unknown>

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function membershipQuery(fields: string): string {
  // The hosted stack field is newer than the repository's generated schema.
  return `query PrMergeMembership($owner: String!, $name: String!, $prNumber: Int!) {
    repository(owner: $owner, name: $name) { pullRequest(number: $prNumber) { ${fields} } }
  }`
}

function pullRequest(payload: Record<string, unknown> | undefined) {
  return asRecord(asRecord(asRecord(payload?.data)?.repository)?.pullRequest)
}

function checkedRepository(pr: Record<string, unknown>, target: MergeTarget): URL {
  if (typeof pr.url !== "string") throw new Error("Membership read returned no pull request URL")
  const url = new URL(pr.url)
  const expectedPath = `/${target.owner}/${target.name}/pull/${target.prNumber}`.toLowerCase()
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname.toLowerCase() !== expectedPath
  ) {
    throw new Error("Membership read returned an unexpected pull request URL")
  }
  return url
}

async function checkMembership(
  target: MergeTarget,
  read: ReadMembership,
): Promise<MembershipResult> {
  const details = { owner: target.owner, name: target.name, prNumber: target.prNumber }
  try {
    let payload = asRecord(await read(membershipQuery(STACK_FIELDS)))
    const errors = payload?.errors
    const stackFieldUnavailable =
      (payload?.data === undefined || payload.data === null) &&
      Array.isArray(errors) &&
      errors.length === 1 &&
      asRecord(errors[0])?.message === UNDEFINED_STACK_FIELD
    if (stackFieldUnavailable) {
      // Older GitHub Enterprise Server schemas may not expose native stacks. Resolve
      // the PR's URL with the same transport before deciding if this exception applies.
      payload = asRecord(await read(membershipQuery("url")))
    }
    if (
      payload?.errors !== undefined &&
      (!Array.isArray(payload.errors) || payload.errors.length)
    ) {
      const firstError: unknown = Array.isArray(payload.errors) ? payload.errors[0] : undefined
      const message = asRecord(firstError)?.message
      throw new Error(typeof message === "string" ? message : "Membership read returned errors")
    }
    const pr = pullRequest(payload)
    if (!pr) throw new Error("Pull request not found in membership read")
    const url = checkedRepository(pr, target)
    const host = url.hostname.toLowerCase().replace(/\.$/, "")
    const hosted =
      host === "github.com" || host.endsWith(".github.com") || host.endsWith(".ghe.com")
    const repo = `${host}/${target.owner}/${target.name}`
    if (stackFieldUnavailable && !hosted) return { ok: true, repo }
    if (stackFieldUnavailable) throw new Error(UNDEFINED_STACK_FIELD)
    if (pr.stack === null) return { ok: true, repo }

    const stackNumber = asRecord(pr.stack)?.number
    if (typeof stackNumber !== "number" || !Number.isSafeInteger(stackNumber) || stackNumber < 1) {
      throw new Error("Membership read returned a missing or malformed stack field")
    }
    return {
      ok: false,
      error: {
        code: errorCodes.Validation,
        message: `Pull request #${target.prNumber} belongs to native stack #${stackNumber}. Use GitHub or gh stack merge to merge it.`,
        retryable: false,
        details: { ...details, stackNumber },
      },
    }
  } catch (error) {
    const code = mapErrorToCode(error)
    return {
      ok: false,
      error: {
        // A failed membership check must end the operation, including errors from custom clients.
        code: code === errorCodes.AdapterUnsupported ? errorCodes.Unknown : code,
        message: "Unable to verify pull request stack membership with the selected merge route",
        retryable: false,
        details,
      },
    }
  }
}

export function guardGraphqlPrMerge(client: GraphqlClient, target: MergeTarget) {
  return checkMembership(target, (query) => client.queryRaw(query, target))
}

export function guardCliPrMerge(runner: CliCommandRunner, target: MergeTarget) {
  return checkMembership(target, async (query) => {
    // gh api and gh pr merge with an explicit OWNER/REPO use gh's authenticated
    // default host. The caller pins the write to the host in the verified PR URL.
    const result = await runner.run(
      "gh",
      [
        "api",
        "graphql",
        "-f",
        `query=${query}`,
        "-f",
        `owner=${target.owner}`,
        "-f",
        `name=${target.name}`,
        "-F",
        `prNumber=${target.prNumber}`,
      ],
      DEFAULT_TIMEOUT_MS,
    )
    const payload = asRecord(result.stdout ? JSON.parse(result.stdout) : undefined)
    if (result.exitCode !== 0 && !(Array.isArray(payload?.errors) && payload.errors.length > 0)) {
      throw new Error(sanitizeCliErrorMessage(result.stderr, result.exitCode))
    }
    return payload
  })
}

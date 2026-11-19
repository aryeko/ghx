import { isObject } from "@core/shared/utils.js"
import type { ResultError } from "../../contracts/envelope.js"
import { errorCodes } from "../../errors/codes.js"
import { isRetryableErrorCode } from "../../errors/retryability.js"

export const GITHUB_REST_ORIGIN = "https://api.github.com"
const API_VERSION = "2026-03-10"
const TIMEOUT_MS = 15_000
const SECONDARY_RATE_LIMIT_WAIT_SECONDS = 60

export class RestError extends Error {
  constructor(readonly result: ResultError) {
    super(result.message)
  }
}

async function reportsSecondaryRateLimit(response: Response): Promise<boolean> {
  try {
    const payload: unknown = await response.json()
    return (
      isObject(payload) &&
      typeof payload.message === "string" &&
      /secondary rate limit/i.test(payload.message)
    )
  } catch {
    return false
  }
}

function integerHeader(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : undefined
}

async function httpError(response: Response, write: boolean): Promise<RestError> {
  const { status, headers } = response
  const retryAfter = integerHeader(headers.get("retry-after"))
  const primaryLimit = headers.get("x-ratelimit-remaining") === "0"
  const isRateLimit =
    status === 429 ||
    (status === 403 &&
      (retryAfter !== undefined || primaryLimit || (await reportsSecondaryRateLimit(response))))

  const code = isRateLimit
    ? errorCodes.RateLimit
    : status === 401 || status === 403
      ? errorCodes.Auth
      : status === 404
        ? errorCodes.NotFound
        : status === 400 || status === 409 || status === 422
          ? errorCodes.Validation
          : errorCodes.Server

  const details: Record<string, unknown> = { status }
  const reset = integerHeader(headers.get("x-ratelimit-reset"))
  if (reset !== undefined) details.rateLimitReset = reset
  if (retryAfter !== undefined) {
    details.retryAfterSeconds = retryAfter
  } else if (isRateLimit && (!primaryLimit || reset === undefined)) {
    details.retryAfterSeconds = SECONDARY_RATE_LIMIT_WAIT_SECONDS
  }

  return new RestError({
    code,
    message: `GitHub REST ${write ? "write" : "read"} failed (HTTP ${status})`,
    retryable: !write && isRetryableErrorCode(code),
    details,
  })
}

async function readRestJson(response: Response): Promise<unknown> {
  let body: string
  try {
    body = await response.text()
  } catch {
    throw new RestError({
      code: errorCodes.Network,
      message: "GitHub REST response transfer failed or timed out",
      retryable: true,
    })
  }

  try {
    return JSON.parse(body) as unknown
  } catch {
    throw new RestError({
      code: errorCodes.Server,
      message: "GitHub REST response could not be read as JSON",
      retryable: false,
    })
  }
}

type RestResponse = {
  status: number
  data: unknown
  headers: { get(name: string): string | null }
}

type RestRequest = {
  method: "GET" | "POST" | "PUT"
  expectedStatuses: readonly number[]
  body?: Record<string, unknown>
}

export type RestReader = (path: string, search?: URLSearchParams) => Promise<RestResponse>

export type RestClient = {
  read: RestReader
  request(path: string, options: RestRequest): Promise<RestResponse>
}

export function githubRequestId(headers: RestResponse["headers"]): string | undefined {
  const id = headers.get("x-github-request-id")
  return id !== null && /^[A-Z0-9:-]{1,80}$/i.test(id) ? id : undefined
}

export function unknownRestWrite(details: Record<string, unknown> = {}): RestError {
  return new RestError({
    code: errorCodes.Server,
    message: "GitHub REST write outcome is unknown. Read remote state before submitting again.",
    retryable: false,
    details: { ...details, submissionOutcome: "unknown" },
  })
}

export function createRestClient(token: string, restFetch: typeof fetch): RestClient {
  const request = async (
    path: string,
    { method, expectedStatuses, body }: RestRequest,
    search?: URLSearchParams,
  ): Promise<RestResponse> => {
    const url = new URL(path, GITHUB_REST_ORIGIN)
    if (url.origin !== GITHUB_REST_ORIGIN) {
      throw new RestError({
        code: errorCodes.Validation,
        message: "Unexpected GitHub REST origin",
        retryable: false,
      })
    }
    if (search) url.search = search.toString()

    const write = method !== "GET"
    let response: Response
    try {
      response = await restFetch(url, {
        ...(write ? { method } : {}),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "x-github-api-version": API_VERSION,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      if (write) throw unknownRestWrite()
      throw new RestError({
        code: errorCodes.Network,
        message: "GitHub REST request failed or timed out",
        retryable: true,
      })
    }

    const { status, headers } = response
    const requestId = githubRequestId(headers)
    const writeDetails =
      write && requestId !== undefined ? { status, githubRequestId: requestId } : { status }
    if (!expectedStatuses.includes(status)) {
      if (write && (response.ok || status >= 500 || status === 408)) {
        throw unknownRestWrite(writeDetails)
      }
      throw await httpError(response, write)
    }

    if (status === 204) return { status, data: null, headers }
    try {
      return { status, data: await readRestJson(response), headers }
    } catch (error) {
      // A conflict rejected this submission. Its response may carry the prior request ID.
      if (status === 409) return { status, data: null, headers }
      if (write) throw unknownRestWrite(writeDetails)
      throw error
    }
  }

  return {
    request,
    read: (path, search) => request(path, { method: "GET", expectedStatuses: [200] }, search),
  }
}

import type { ResultError } from "../../contracts/envelope.js"
import { errorCodes } from "../../errors/codes.js"
import { isRetryableErrorCode } from "../../errors/retryability.js"

export const GITHUB_REST_ORIGIN = "https://api.github.com"
const API_VERSION = "2026-03-10"
const TIMEOUT_MS = 15_000

export class RestError extends Error {
  constructor(readonly result: ResultError) {
    super(result.message)
  }
}

function httpError(response: Response): RestError {
  const { status, headers } = response
  const retryAfter = headers.get("retry-after")
  const isRateLimit =
    status === 429 ||
    (status === 403 && (retryAfter !== null || headers.get("x-ratelimit-remaining") === "0"))

  const code = isRateLimit
    ? errorCodes.RateLimit
    : status === 401 || status === 403
      ? errorCodes.Auth
      : status === 404
        ? errorCodes.NotFound
        : status === 400 || status === 422
          ? errorCodes.Validation
          : errorCodes.Server

  const details: Record<string, unknown> = { status }
  if (retryAfter !== null && /^\d+$/.test(retryAfter)) {
    details.retryAfterSeconds = Number(retryAfter)
  }
  const reset = headers.get("x-ratelimit-reset")
  if (reset !== null && /^\d+$/.test(reset)) {
    details.rateLimitReset = Number(reset)
  }

  return new RestError({
    code,
    message: `GitHub REST read failed (HTTP ${status})`,
    retryable: isRetryableErrorCode(code),
    details,
  })
}

export type RestReader = (
  path: string,
  search?: URLSearchParams,
) => Promise<{ data: unknown; headers: { get(name: string): string | null } }>

export function createRestReader(token: string, restFetch: typeof fetch): RestReader {
  return async (path: string, search?: URLSearchParams) => {
    const url = new URL(path, GITHUB_REST_ORIGIN)
    if (url.origin !== GITHUB_REST_ORIGIN) {
      throw new RestError({
        code: errorCodes.Validation,
        message: "Unexpected GitHub REST origin",
        retryable: false,
      })
    }
    if (search) url.search = search.toString()

    let response: Response
    try {
      response = await restFetch(url, {
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${token}`,
          "x-github-api-version": API_VERSION,
        },
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw new RestError({
        code: errorCodes.Network,
        message: "GitHub REST request failed or timed out",
        retryable: true,
      })
    }

    if (!response.ok) throw httpError(response)

    try {
      const data: unknown = await response.json()
      return { data, headers: response.headers }
    } catch {
      throw new RestError({
        code: errorCodes.Server,
        message: "GitHub REST response could not be read as JSON",
        retryable: false,
      })
    }
  }
}

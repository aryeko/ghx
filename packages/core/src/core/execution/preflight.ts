import type { RouteSource } from "../contracts/envelope.js"
import type { ErrorCode } from "../errors/codes.js"
import { errorCodes } from "../errors/codes.js"
import { logger } from "../telemetry/log.js"

export type PreflightInput = {
  route: RouteSource
  githubToken?: string | null
  githubHost?: string
  githubClientPresent?: boolean
  ghCliAvailable?: boolean
  ghAuthenticated?: boolean
}

export type PreflightResult =
  | { ok: true }
  | {
      ok: false
      code: ErrorCode
      message: string
      retryable: boolean
      details: { route: RouteSource }
    }

export function preflightCheck(input: PreflightInput): PreflightResult {
  function fail(code: ErrorCode, message: string): Extract<PreflightResult, { ok: false }> {
    logger.debug("preflight.failed", { route: input.route, code, message })
    return {
      ok: false,
      code,
      message,
      retryable: false,
      details: { route: input.route },
    }
  }

  if (input.route === "rest") {
    if (input.githubHost !== undefined && input.githubHost.toLowerCase() !== "github.com") {
      return fail(errorCodes.AdapterUnsupported, "REST stack capabilities require GitHub.com")
    }
    if (!input.githubToken?.trim()) {
      return fail(errorCodes.Auth, "GitHub token is required for the REST route")
    }
  }

  if (input.route === "cli" && input.ghCliAvailable === false) {
    return fail(errorCodes.AdapterUnsupported, "GitHub CLI is required for cli route")
  }

  if (input.route === "cli" && input.ghAuthenticated === false) {
    return fail(errorCodes.Auth, "GitHub CLI authentication is required for cli route")
  }

  if (input.route === "graphql") {
    const token = input.githubToken?.trim()
    if (!token && input.githubClientPresent !== true) {
      return fail(errorCodes.Auth, "GitHub token or client is required for graphql route")
    }
  }

  logger.debug("preflight.ok", { route: input.route })
  return { ok: true }
}

import type { ErrorCode } from "../errors/codes.js"
import { errorCodes } from "../errors/codes.js"
import type { ResultEnvelope, RouteSource } from "../contracts/envelope.js"
import type { OperationCard } from "../registry/types.js"
import { normalizeError } from "../execution/normalizer.js"

type PreflightResult =
  | { ok: true }
  | { ok: false; code: ErrorCode; message: string; retryable: boolean; details?: Record<string, unknown> }

type ExecuteOptions = {
  card: OperationCard
  params: Record<string, unknown>
  trace?: boolean
  retry?: {
    maxAttemptsPerRoute?: number
  }
  preflight: (route: RouteSource) => Promise<PreflightResult>
  routes: Record<RouteSource, (params: Record<string, unknown>) => Promise<ResultEnvelope>>
}

function getRequiredInputs(card: OperationCard): string[] {
  const required = card.input_schema.required
  if (!Array.isArray(required)) {
    return []
  }

  return required.filter((item): item is string => typeof item === "string")
}

function validateRequiredParams(card: OperationCard, params: Record<string, unknown>): string[] {
  const required = getRequiredInputs(card)
  return required.filter((key) => params[key] === undefined || params[key] === null || params[key] === "")
}

function routePlan(card: OperationCard): RouteSource[] {
  const planned = new Set<RouteSource>([card.routing.preferred, ...card.routing.fallbacks])
  return [...planned]
}

export async function execute(options: ExecuteOptions): Promise<ResultEnvelope> {
  const missing = validateRequiredParams(options.card, options.params)
  if (missing.length > 0) {
    return normalizeError(
      {
        code: errorCodes.Validation,
        message: `Missing required params: ${missing.join(", ")}`,
        retryable: false,
        details: { missing }
      },
      options.card.routing.preferred,
      {
        capabilityId: options.card.capability_id,
        reason: "CAPABILITY_LIMIT"
      }
    )
  }

  const attempts: NonNullable<ResultEnvelope["meta"]["attempts"]> = []
  const maxAttemptsPerRoute = Math.max(1, options.retry?.maxAttemptsPerRoute ?? 1)
  let lastError: ResultEnvelope["error"]
  let firstError: ResultEnvelope["error"]

  for (const route of routePlan(options.card)) {
    const preflight = await options.preflight(route)
    if (!preflight.ok) {
      attempts.push({ route, status: "skipped", error_code: preflight.code })
      lastError = {
        code: preflight.code,
        message: preflight.message,
        retryable: preflight.retryable,
        details: preflight.details
      }
      firstError ??= lastError
      continue
    }

    for (let attempt = 0; attempt < maxAttemptsPerRoute; attempt += 1) {
      const result = await options.routes[route](options.params)
      attempts.push({ route, status: result.ok ? "success" : "error", error_code: result.error?.code })

      if (result.ok) {
        if (options.trace) {
          result.meta.attempts = attempts
        }
        return result
      }

      lastError = result.error
      firstError ??= result.error
      if (!result.error?.retryable) {
        if (result.error?.code !== errorCodes.AdapterUnsupported) {
          if (options.trace) {
            result.meta.attempts = attempts
          }
          return result
        }
        break
      }
    }
  }

  const finalError = firstError ?? lastError ?? {
    code: errorCodes.Unknown,
    message: "No route produced a result",
    retryable: false
  }

  const envelope = normalizeError(finalError, options.card.routing.preferred, {
    capabilityId: options.card.capability_id,
    reason: "CARD_FALLBACK"
  })

  if (options.trace) {
    envelope.meta.attempts = attempts
  }

  return envelope
}

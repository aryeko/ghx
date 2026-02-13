import type { ErrorCode } from "../errors/codes.js"
import { errorCodes } from "../errors/codes.js"
import type { ResultEnvelope, RouteSource } from "../contracts/envelope.js"
import type { OperationCard } from "../registry/types.js"
import { validateInput, validateOutput } from "../registry/schema-validator.js"
import { normalizeError } from "../execution/normalizer.js"
import { logMetric } from "../telemetry/logger.js"

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

function routePlan(card: OperationCard): RouteSource[] {
  const planned = new Set<RouteSource>([card.routing.preferred, ...card.routing.fallbacks])
  return [...planned]
}

export async function execute(options: ExecuteOptions): Promise<ResultEnvelope> {
  const inputValidation = validateInput(options.card.input_schema, options.params)
  if (!inputValidation.ok) {
    return normalizeError(
      {
        code: errorCodes.Validation,
        message: "Input schema validation failed",
        retryable: false,
        details: { ajvErrors: inputValidation.errors }
      },
      options.card.routing.preferred,
      {
        capabilityId: options.card.capability_id,
        reason: "INPUT_VALIDATION"
      }
    )
  }

  const attempts: NonNullable<ResultEnvelope["meta"]["attempts"]> = []
  const maxAttemptsPerRoute = Math.max(1, options.retry?.maxAttemptsPerRoute ?? 1)
  let lastError: ResultEnvelope["error"]
  let firstError: ResultEnvelope["error"]

  for (const route of routePlan(options.card)) {
    logMetric("route.plan", 1, {
      capability_id: options.card.capability_id,
      route
    })

    const preflight = await options.preflight(route)
    if (!preflight.ok) {
      logMetric("route.preflight_skipped", 1, {
        capability_id: options.card.capability_id,
        route,
        error_code: preflight.code
      })
      attempts.push({ route, status: "skipped", error_code: preflight.code })
      lastError = {
        code: preflight.code,
        message: preflight.message,
        retryable: preflight.retryable,
        ...(preflight.details ? { details: preflight.details } : {})
      }
      firstError ??= lastError
      continue
    }

    const routeHandler = options.routes[route]
    if (typeof routeHandler !== "function") {
      logMetric("route.missing_handler", 1, {
        capability_id: options.card.capability_id,
        route
      })

      const handlerError = {
        code: errorCodes.AdapterUnsupported,
        message: `No route handler configured for '${route}'`,
        retryable: false,
        details: { route }
      }

      attempts.push({ route, status: "skipped", error_code: errorCodes.AdapterUnsupported })
      lastError = handlerError
      firstError ??= handlerError
      continue
    }

    for (let attempt = 0; attempt < maxAttemptsPerRoute; attempt += 1) {
      const result = await routeHandler(options.params)
      logMetric("route.attempt", 1, {
        capability_id: options.card.capability_id,
        route,
        ok: result.ok
      })
      const attemptRecord: { route: RouteSource; status: "success" | "error"; error_code?: ErrorCode } = {
        route,
        status: result.ok ? "success" : "error"
      }
      if (result.error?.code) {
        attemptRecord.error_code = result.error.code
      }
      attempts.push(attemptRecord)

      if (result.ok) {
        const outputValidation = validateOutput(options.card.output_schema, result.data)
        if (!outputValidation.ok) {
          const envelope = normalizeError(
            {
              code: errorCodes.Server,
              message: "Output schema validation failed",
              retryable: false,
              details: { ajvErrors: outputValidation.errors }
            },
            route,
            {
              capabilityId: options.card.capability_id,
              reason: "OUTPUT_VALIDATION"
            }
          )

          if (options.trace) {
            envelope.meta.attempts = attempts
          }

          return envelope
        }

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

  const finalError = lastError ?? firstError ?? {
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

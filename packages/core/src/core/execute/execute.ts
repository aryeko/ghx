import type { ResultEnvelope, RouteSource } from "../contracts/envelope.js"
import type { ErrorCode } from "../errors/codes.js"
import { errorCodes } from "../errors/codes.js"
import { normalizeError } from "../execution/normalizer.js"
import {
  formatSchemaErrorDetails,
  validateInput,
  validateOutput,
} from "../registry/schema-validator.js"
import type { OperationCard } from "../registry/types.js"
import { selectPreferredRoute } from "../routing/suitability.js"
import { logger } from "../telemetry/log.js"
import { logMetric } from "../telemetry/logger.js"

type PreflightResult =
  | { ok: true }
  | {
      ok: false
      code: ErrorCode
      message: string
      retryable: boolean
      details?: Record<string, unknown>
    }

type ExecuteOptions = {
  card: OperationCard
  params: Record<string, unknown>
  routingContext?: Record<string, unknown>
  trace?: boolean
  retry?: {
    maxAttemptsPerRoute?: number
  }
  preflight: (route: RouteSource) => Promise<PreflightResult>
  routes: Record<RouteSource, (params: Record<string, unknown>) => Promise<ResultEnvelope>>
}

function routePlan(
  card: OperationCard,
  params: Record<string, unknown>,
  routingContext: Record<string, unknown>,
): RouteSource[] {
  const preferred = selectPreferredRoute(card, params, routingContext)
  const planned = new Set<RouteSource>([preferred, ...card.routing.fallbacks])
  return [...planned]
}

export async function execute(options: ExecuteOptions): Promise<ResultEnvelope> {
  const inputValidation = validateInput(options.card.input_schema, options.params)
  if (!inputValidation.ok) {
    return normalizeError(
      {
        code: errorCodes.Validation,
        message: `Input validation failed: ${formatSchemaErrorDetails(inputValidation.errors)}`,
        retryable: false,
        details: { ajvErrors: inputValidation.errors },
      },
      options.card.routing.preferred,
      {
        capabilityId: options.card.capability_id,
        reason: "INPUT_VALIDATION",
      },
    )
  }

  const attempts: NonNullable<ResultEnvelope["meta"]["attempts"]> = []
  const maxAttemptsPerRoute = Math.max(1, options.retry?.maxAttemptsPerRoute ?? 1)
  let lastError: ResultEnvelope["error"]
  let firstError: ResultEnvelope["error"]

  const routingContext = options.routingContext ?? {}

  for (const route of routePlan(options.card, options.params, routingContext)) {
    logMetric("route.plan", 1, {
      capability_id: options.card.capability_id,
      route,
    })
    logger.debug("route.plan", {
      capability_id: options.card.capability_id,
      route,
    })

    const preflight = await options.preflight(route)
    if (!preflight.ok) {
      logMetric("route.preflight_skipped", 1, {
        capability_id: options.card.capability_id,
        route,
        error_code: preflight.code,
      })
      logger.warn("route.preflight_skipped", {
        capability_id: options.card.capability_id,
        route,
        error_code: preflight.code,
      })
      attempts.push({ route, status: "skipped", error_code: preflight.code })
      lastError = {
        code: preflight.code,
        message: preflight.message,
        retryable: preflight.retryable,
        ...(preflight.details ? { details: preflight.details } : {}),
      }
      firstError ??= lastError
      continue
    }

    const routeHandler = options.routes[route]
    if (typeof routeHandler !== "function") {
      logMetric("route.missing_handler", 1, {
        capability_id: options.card.capability_id,
        route,
      })
      logger.warn("route.missing_handler", {
        capability_id: options.card.capability_id,
        route,
      })

      const handlerError = {
        code: errorCodes.AdapterUnsupported,
        message: `No route handler configured for '${route}'`,
        retryable: false,
        details: { route },
      }

      attempts.push({
        route,
        status: "skipped",
        error_code: errorCodes.AdapterUnsupported,
      })
      lastError = handlerError
      firstError ??= handlerError
      continue
    }

    for (let attempt = 0; attempt < maxAttemptsPerRoute; attempt += 1) {
      const result = await routeHandler(options.params)
      logMetric("route.attempt", 1, {
        capability_id: options.card.capability_id,
        route,
        ok: result.ok,
      })
      logger.debug("route.attempt", {
        capability_id: options.card.capability_id,
        route,
        ok: result.ok,
        attempt,
      })
      const attemptRecord: {
        route: RouteSource
        status: "success" | "error"
        error_code?: ErrorCode
      } = {
        route,
        status: result.ok ? "success" : "error",
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
              message: `Output schema validation failed: ${formatSchemaErrorDetails(outputValidation.errors)}`,
              retryable: false,
              details: { ajvErrors: outputValidation.errors },
            },
            route,
            {
              capabilityId: options.card.capability_id,
              reason: "OUTPUT_VALIDATION",
            },
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
      if (!result.ok && result.error) {
        logger.debug("route.attempt_failed", {
          capability_id: options.card.capability_id,
          route,
          attempt,
          error_code: result.error.code,
          retryable: result.error.retryable,
        })
      }
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

  const finalError = lastError ??
    firstError ?? {
      code: errorCodes.Unknown,
      message: "No route produced a result",
      retryable: false,
    }

  const envelope = normalizeError(finalError, options.card.routing.preferred, {
    capabilityId: options.card.capability_id,
    reason: "CARD_FALLBACK",
  })

  if (options.trace) {
    envelope.meta.attempts = attempts
  }

  return envelope
}

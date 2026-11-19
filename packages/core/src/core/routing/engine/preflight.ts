import type { ChainStepResult, RouteSource } from "@core/core/contracts/envelope.js"
import { errorCodes } from "@core/core/errors/codes.js"
import { mapErrorToCode } from "@core/core/errors/map-error.js"
import { getOperationCard } from "@core/core/registry/index.js"
import { formatSchemaErrorDetails, validateInput } from "@core/core/registry/schema-validator.js"
import type { OperationCard } from "@core/core/registry/types.js"
import { selectPreferredRoute } from "@core/core/routing/suitability.js"
import { resolutionLookups } from "./resolve.js"
import type { ClassifiedStep } from "./types.js"

export const SINGLE_HANDLER_GRAPHQL_TASKS = new Set([
  "pr.merge",
  "pr.comments.reactions.list",
  "pr.threads.list",
  "project_v2.fields.list",
  "project_v2.items.list",
])

export type PreflightSuccess = {
  ok: true
  steps: ClassifiedStep[]
  cards: OperationCard[]
}

export type PreflightFailure = {
  ok: false
  results: ChainStepResult[]
  routeUsed: RouteSource
}

export function runPreflight(
  requests: Array<{ task: string; input: Record<string, unknown> }>,
): PreflightSuccess | PreflightFailure {
  const preflightErrorByIndex = new Map<number, ChainStepResult>()
  const cards: OperationCard[] = []

  for (let i = 0; i < requests.length; i += 1) {
    const req = requests[i]
    if (req === undefined) continue
    try {
      const card = getOperationCard(req.task)
      if (!card) {
        throw new Error(`Invalid task: ${req.task}`)
      }

      // REST steps validate again at dispatch. Keep schema defaults off the caller's input.
      const params = card.routing.preferred === "rest" ? { ...req.input } : req.input
      const inputValidation = validateInput(card.input_schema, params)
      if (!inputValidation.ok) {
        const details = formatSchemaErrorDetails(inputValidation.errors)
        throw new Error(`Input validation failed: ${details}`)
      }

      if (!card.graphql && !card.cli && !card.rest) {
        throw new Error(
          `capability '${req.task}' has no supported route (graphql, cli, or rest) and cannot be chained`,
        )
      }

      if (card.graphql?.resolution) {
        for (const lookup of resolutionLookups(card)) {
          for (const [, inputField] of Object.entries(lookup.vars)) {
            if (req.input[inputField] === undefined) {
              throw new Error(
                `Resolution pre-flight failed for '${req.task}': lookup var '${inputField}' is missing from input`,
              )
            }
          }
        }
      }

      cards.push(card)
    } catch (err) {
      preflightErrorByIndex.set(i, {
        task: req.task,
        ok: false,
        error: {
          code: mapErrorToCode(err),
          message: err instanceof Error ? err.message : String(err),
          retryable: false,
        },
      })
    }
  }

  if (preflightErrorByIndex.size > 0) {
    const results: ChainStepResult[] = requests.map(
      (req, i) =>
        preflightErrorByIndex.get(i) ?? {
          task: req?.task ?? "unknown",
          ok: false,
          error: {
            code: errorCodes.Unknown,
            message: "pre-flight failed",
            retryable: false,
          },
        },
    )
    const routeUsed: RouteSource =
      cards.length > 0 && cards.every((card) => card.routing.preferred === "rest")
        ? "rest"
        : cards.length > 0 && cards.every((card) => !card.graphql && !card.rest)
          ? "cli"
          : "graphql"
    return { ok: false, results, routeUsed }
  }

  const steps: ClassifiedStep[] = []
  let cardIndex = 0
  for (let i = 0; i < requests.length; i += 1) {
    const req = requests[i]
    const card = cards[cardIndex]
    if (req === undefined || card === undefined) continue
    cardIndex += 1

    let route: ClassifiedStep["route"]
    const preferredRoute = selectPreferredRoute(card, req.input, {})
    if (preferredRoute === "rest" && card.rest) {
      route = "rest"
    } else if (preferredRoute === "cli" && card.cli) {
      route = "cli"
    } else if (SINGLE_HANDLER_GRAPHQL_TASKS.has(req.task) && card.graphql) {
      route = "single"
    } else if (!card.graphql && card.cli) {
      route = "cli"
    } else if (card.graphql) {
      route = card.graphql.operationType === "query" ? "gql-query" : "gql-mutation"
    } else if (card.cli) {
      route = "cli"
    } else {
      route = "gql-query"
    }

    steps.push({ route, card, index: i, request: req })
  }

  return { ok: true, steps, cards }
}

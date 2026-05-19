import type { RouteSource } from "../contracts/envelope.js"
import type { OperationCard } from "../registry/types.js"

function parsePredicateValue(raw: string): unknown {
  const value = raw.trim()
  if (value === "true") {
    return true
  }
  if (value === "false") {
    return false
  }
  if (value === "null") {
    return null
  }

  const numeric = Number(value)
  if (!Number.isNaN(numeric) && value.length > 0) {
    return numeric
  }

  return value.replace(/^['"]|['"]$/g, "")
}

function resolvePathValue(source: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".").filter((segment) => segment.length > 0)
  let current: unknown = source

  for (const segment of segments) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      return undefined
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

export function selectPreferredRoute(
  card: OperationCard,
  params: Record<string, unknown>,
  routingContext: Record<string, unknown>,
): RouteSource {
  const rules = card.routing.suitability ?? []

  for (const rule of rules) {
    const alwaysMatch = /^(cli|graphql|rest)$/i.exec(rule.predicate.trim())
    const alwaysRoute = alwaysMatch?.[1]
    if (rule.when === "always" && alwaysRoute) {
      return alwaysRoute.toLowerCase() as RouteSource
    }

    const conditionalMatch = /^(cli|graphql|rest)\s+if\s+([a-zA-Z0-9_.]+)\s*(==|!=)\s*(.+)$/i.exec(
      rule.predicate.trim(),
    )

    if (!conditionalMatch) {
      continue
    }

    const [, targetRouteRaw = "", rawPath = "", operator = "==", rawExpected = ""] =
      conditionalMatch
    const targetRoute = targetRouteRaw.toLowerCase() as RouteSource
    const source = rule.when === "env" ? routingContext : params
    const path =
      rawPath.startsWith("params.") || rawPath.startsWith("env.")
        ? rawPath.split(".").slice(1).join(".")
        : rawPath
    const actual = resolvePathValue(source, path)
    const expected = parsePredicateValue(rawExpected)
    const matches = operator === "==" ? actual === expected : actual !== expected

    if (matches) {
      return targetRoute
    }
  }

  return card.routing.preferred
}

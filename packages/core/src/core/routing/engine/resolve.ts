import type { InjectSpec, LookupSpec, OperationCard } from "@core/core/registry/types.js"
import { logger } from "@core/core/telemetry/log.js"
import { buildBatchQuery, extractRootFieldName } from "@core/gql/batch.js"
import { getLookupDocument } from "@core/gql/document-registry.js"
import type { GithubClient } from "@core/gql/github-client.js"
import type { ResolutionCache } from "../resolution-cache.js"
import { buildCacheKey } from "../resolution-cache.js"
import type { ClassifiedStep } from "./types.js"

export const DEFAULT_LOOKUP_ID = "default"

export type StepResolutionResults = Record<string, unknown>
export type ResolutionResults = Record<number, StepResolutionResults>

type LookupInput = {
  alias: string
  query: string
  variables: Record<string, unknown>
  stepIndex: number
  lookupId: string
  lookup: LookupSpec & { id: string }
  card: OperationCard
}

export function resolutionLookups(card: OperationCard): Array<LookupSpec & { id: string }> {
  const resolution = card.graphql?.resolution
  if (!resolution) return []

  const lookups: Array<LookupSpec & { id: string }> = []
  if (resolution.lookup) {
    lookups.push({ ...resolution.lookup, id: resolution.lookup.id ?? DEFAULT_LOOKUP_ID })
  }
  for (const lookup of resolution.lookups ?? []) {
    lookups.push({ ...lookup, id: lookup.id ?? DEFAULT_LOOKUP_ID })
  }
  return lookups
}

export function defaultLookupId(card: OperationCard): string {
  const lookups = resolutionLookups(card)
  if (lookups.length !== 1) {
    throw new Error(
      `Resolution failed for '${card.capability_id}': inject must specify from_lookup when multiple lookups are configured`,
    )
  }
  const lookup = lookups[0]
  if (!lookup) {
    throw new Error(
      `Resolution failed for '${card.capability_id}': inject requires a lookup but none is configured`,
    )
  }
  return lookup.id
}

export function lookupIdForInject(card: OperationCard, spec: InjectSpec): string | null {
  if (spec.source === "scalar" || spec.source === "map_array") {
    return spec.from_lookup ?? defaultLookupId(card)
  }
  return null
}

function buildLookupVars(
  lookup: LookupSpec,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const vars: Record<string, unknown> = {}
  for (const [lookupVar, inputField] of Object.entries(lookup.vars)) {
    vars[lookupVar] = input[inputField]
  }
  return vars
}

function getAtPath(obj: unknown, path: string): unknown {
  const parts = path.split(".")
  let current = obj
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function connectionPathForNodesPath(nodesPath: string): string | null {
  return nodesPath.endsWith(".nodes") ? nodesPath.slice(0, -".nodes".length) : null
}

function afterVariableName(connectionPath: string): string {
  const fieldName = connectionPath.split(".").at(-1)
  if (!fieldName) {
    throw new Error(`Resolution pagination failed: invalid connection path '${connectionPath}'`)
  }
  return `${fieldName}After`
}

function mapArrayConnectionPaths(card: OperationCard, lookupId: string): string[] {
  const paths = new Set<string>()
  for (const spec of card.graphql?.resolution?.inject ?? []) {
    if (spec.source !== "map_array") continue
    if (lookupIdForInject(card, spec) !== lookupId) continue
    const connectionPath = connectionPathForNodesPath(spec.nodes_path)
    if (connectionPath !== null) paths.add(connectionPath)
  }
  return [...paths]
}

function mergeConnectionPage(
  existingResult: unknown,
  pageResult: unknown,
  connectionPath: string,
): void {
  const existingConnection = getAtPath(existingResult, connectionPath)
  const pageConnection = getAtPath(pageResult, connectionPath)
  if (
    typeof existingConnection !== "object" ||
    existingConnection === null ||
    Array.isArray(existingConnection) ||
    typeof pageConnection !== "object" ||
    pageConnection === null ||
    Array.isArray(pageConnection)
  ) {
    return
  }

  const existingRecord = existingConnection as Record<string, unknown>
  const pageRecord = pageConnection as Record<string, unknown>
  const existingNodes = Array.isArray(existingRecord.nodes) ? existingRecord.nodes : []
  const pageNodes = Array.isArray(pageRecord.nodes) ? pageRecord.nodes : []
  existingRecord.nodes = [...existingNodes, ...pageNodes]
  existingRecord.pageInfo = pageRecord.pageInfo
}

async function hydratePaginatedMapArrayLookups(
  lookupInputs: LookupInput[],
  lookupResults: ResolutionResults,
  githubClient: GithubClient,
): Promise<void> {
  let guard = 0

  while (guard < 100) {
    guard += 1
    const pageInputs: Array<LookupInput & { connectionPath: string }> = []

    for (const lookup of lookupInputs) {
      const result = lookupResults[lookup.stepIndex]?.[lookup.lookupId]
      if (result === undefined) continue

      for (const connectionPath of mapArrayConnectionPaths(lookup.card, lookup.lookupId)) {
        const pageInfo = getAtPath(result, `${connectionPath}.pageInfo`)
        const hasNextPage =
          typeof pageInfo === "object" &&
          pageInfo !== null &&
          !Array.isArray(pageInfo) &&
          (pageInfo as Record<string, unknown>).hasNextPage === true
        if (!hasNextPage) continue

        const endCursor = (pageInfo as Record<string, unknown>).endCursor
        if (typeof endCursor !== "string" || endCursor.length === 0) {
          throw new Error(
            `Resolution pagination failed for step ${lookup.stepIndex}: '${connectionPath}' hasNextPage is true but endCursor is missing`,
          )
        }

        const afterVar = afterVariableName(connectionPath)
        if (!lookup.query.includes(`$${afterVar}`)) {
          continue
        }

        pageInputs.push({
          ...lookup,
          variables: { ...lookup.variables, [afterVar]: endCursor },
          connectionPath,
        })
      }
    }

    if (pageInputs.length === 0) return

    const { document, variables } = buildBatchQuery(
      pageInputs.map(({ alias, query, variables }) => ({ alias, query, variables })),
    )
    logger.debug("resolution.pagination_start", { count: pageInputs.length, page: guard })
    const rawResult = await githubClient.query(document, variables)
    logger.debug("resolution.pagination_complete", { count: pageInputs.length, page: guard })

    for (const pageInput of pageInputs) {
      const rawValue = (rawResult as Record<string, unknown>)[pageInput.alias]
      if (rawValue === undefined) continue

      const rootFieldName = extractRootFieldName(pageInput.query)
      const pageResult = rootFieldName !== null ? { [rootFieldName]: rawValue } : rawValue
      mergeConnectionPage(
        lookupResults[pageInput.stepIndex]?.[pageInput.lookupId],
        pageResult,
        pageInput.connectionPath,
      )
    }
  }

  throw new Error("Resolution pagination failed: exceeded 100 pages")
}

export async function runResolutionPhase(
  steps: ClassifiedStep[],
  requests: Array<{ task: string; input: Record<string, unknown> }>,
  githubClient: GithubClient,
  resolutionCache?: ResolutionCache,
): Promise<ResolutionResults> {
  const lookupResults: ResolutionResults = {}

  const lookupInputs: LookupInput[] = []

  for (const step of steps) {
    const { card, index } = step
    if (!card.graphql?.resolution) continue

    const req = requests[index]
    if (req === undefined) continue

    for (const lookup of resolutionLookups(card)) {
      const lookupVars = buildLookupVars(lookup, req.input)

      // Check resolution cache before scheduling network call
      if (resolutionCache) {
        const cacheKey = buildCacheKey(`${lookup.id}:${lookup.operationName}`, lookupVars)
        const cached = resolutionCache.get(cacheKey)
        if (cached !== undefined) {
          lookupResults[index] ??= {}
          lookupResults[index][lookup.id] = cached
          logger.debug("resolution.cache_hit", {
            step: index,
            lookup: lookup.id,
            operation: lookup.operationName,
            key: cacheKey,
          })
          continue
        }
      }

      logger.debug("resolution.lookup_scheduled", {
        step: index,
        lookup: lookup.id,
        operation: lookup.operationName,
      })
      lookupInputs.push({
        alias: lookup.id === DEFAULT_LOOKUP_ID ? `step${index}` : `step${index}_${lookup.id}`,
        query: getLookupDocument(lookup.operationName),
        variables: lookupVars,
        stepIndex: index,
        lookupId: lookup.id,
        lookup,
        card,
      })
    }
  }

  if (lookupInputs.length === 0) {
    return lookupResults
  }

  const { document, variables } = buildBatchQuery(
    lookupInputs.map(({ alias, query, variables }) => ({
      alias,
      query,
      variables,
    })),
  )

  logger.debug("query.batch_start", { count: lookupInputs.length })
  // Throws on network/GQL error — caller handles it
  const rawResult = await githubClient.query(document, variables)
  logger.debug("query.batch_complete", { count: lookupInputs.length })

  // Un-alias results: BatchChain result has keys like "step0", "step0_projectOrg", etc.
  // GitHub returns the root field value directly under the alias key — no extra wrapper.
  // Re-wrap it so applyInject path traversal (e.g. "repository.issue.id") works correctly.
  for (const { alias, query, stepIndex, lookupId } of lookupInputs) {
    const rawValue = (rawResult as Record<string, unknown>)[alias]
    if (rawValue === undefined) {
      logger.debug("resolution.step_missing", { step: stepIndex, lookup: lookupId, alias })
      continue
    }
    const rootFieldName = extractRootFieldName(query)
    const result = rootFieldName !== null ? { [rootFieldName]: rawValue } : rawValue
    lookupResults[stepIndex] ??= {}
    lookupResults[stepIndex][lookupId] = result
    logger.debug("resolution.step_resolved", { step: stepIndex, lookup: lookupId, alias })
  }

  await hydratePaginatedMapArrayLookups(lookupInputs, lookupResults, githubClient)

  for (const { stepIndex, lookupId, lookup, variables } of lookupInputs) {
    if (resolutionCache) {
      const result = lookupResults[stepIndex]?.[lookupId]
      if (result === undefined) continue
      resolutionCache.set(buildCacheKey(`${lookupId}:${lookup.operationName}`, variables), result)
      logger.debug("resolution.cache_set", {
        step: stepIndex,
        lookup: lookupId,
        operation: lookup.operationName,
      })
    }
  }

  return lookupResults
}

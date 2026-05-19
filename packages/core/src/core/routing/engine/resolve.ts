import type { OperationCard } from "@core/core/registry/types.js"
import { logger } from "@core/core/telemetry/log.js"
import { buildBatchQuery, extractRootFieldName } from "@core/gql/batch.js"
import { getLookupDocument } from "@core/gql/document-registry.js"
import type { GithubClient } from "@core/gql/github-client.js"
import type { ResolutionCache } from "../resolution-cache.js"
import { buildCacheKey } from "../resolution-cache.js"
import type { ClassifiedStep } from "./types.js"

export type ResolutionResults = Record<number, unknown>

type LookupInput = {
  alias: string
  query: string
  variables: Record<string, unknown>
  stepIndex: number
  card: OperationCard
}

function buildLookupVars(
  card: OperationCard,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const vars: Record<string, unknown> = {}
  if (card.graphql?.resolution) {
    for (const [lookupVar, inputField] of Object.entries(card.graphql.resolution.lookup.vars)) {
      vars[lookupVar] = input[inputField]
    }
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

function mapArrayConnectionPaths(card: OperationCard): string[] {
  const paths = new Set<string>()
  for (const spec of card.graphql?.resolution?.inject ?? []) {
    if (spec.source !== "map_array") continue
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
      const result = lookupResults[lookup.stepIndex]
      if (result === undefined) continue

      for (const connectionPath of mapArrayConnectionPaths(lookup.card)) {
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
      mergeConnectionPage(lookupResults[pageInput.stepIndex], pageResult, pageInput.connectionPath)
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

    const lookupVars = buildLookupVars(card, req.input)

    // Check resolution cache before scheduling network call
    if (resolutionCache) {
      const cacheKey = buildCacheKey(card.graphql.resolution.lookup.operationName, lookupVars)
      const cached = resolutionCache.get(cacheKey)
      if (cached !== undefined) {
        lookupResults[index] = cached
        logger.debug("resolution.cache_hit", {
          step: index,
          operation: card.graphql.resolution.lookup.operationName,
          key: cacheKey,
        })
        continue
      }
    }

    logger.debug("resolution.lookup_scheduled", {
      step: index,
      operation: card.graphql.resolution.lookup.operationName,
    })
    lookupInputs.push({
      alias: `step${index}`,
      query: getLookupDocument(card.graphql.resolution.lookup.operationName),
      variables: lookupVars,
      stepIndex: index,
      card,
    })
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

  // Un-alias results: BatchChain result has keys like "step0", "step2", etc.
  // GitHub returns the root field value directly under the alias key — no extra wrapper.
  // Re-wrap it so applyInject path traversal (e.g. "repository.issue.id") works correctly.
  for (const { alias, query, stepIndex } of lookupInputs) {
    const rawValue = (rawResult as Record<string, unknown>)[alias]
    if (rawValue === undefined) {
      logger.debug("resolution.step_missing", { step: stepIndex, alias })
      continue
    }
    const rootFieldName = extractRootFieldName(query)
    const result = rootFieldName !== null ? { [rootFieldName]: rawValue } : rawValue
    lookupResults[stepIndex] = result
    logger.debug("resolution.step_resolved", { step: stepIndex, alias })
  }

  await hydratePaginatedMapArrayLookups(lookupInputs, lookupResults, githubClient)

  for (const { stepIndex } of lookupInputs) {
    if (resolutionCache) {
      const step = steps.find((s) => s.index === stepIndex)
      const req = requests[stepIndex]
      if (step?.card.graphql?.resolution && req) {
        const lookupVars = buildLookupVars(step.card, req.input)
        const result = lookupResults[stepIndex]
        if (result === undefined) continue
        resolutionCache.set(
          buildCacheKey(step.card.graphql.resolution.lookup.operationName, lookupVars),
          result,
        )
        logger.debug("resolution.cache_set", {
          step: stepIndex,
          operation: step.card.graphql.resolution.lookup.operationName,
        })
      }
    }
  }

  return lookupResults
}

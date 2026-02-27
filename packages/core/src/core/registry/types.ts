import type { RouteSource } from "../contracts/envelope.js"

/** Represents a JSON Schema definition for card inputs/outputs. */
export type JsonSchema = Record<string, unknown>

/** Defines when a fallback route should override the preferred route. */
export interface SuitabilityRule {
  when: "always" | "env" | "params"
  predicate: string
  reason: string
}

/**
 * Extracts a single value from a Phase 1 lookup result using a dot-notation path.
 *
 * Use when the mutation needs one node ID that can be resolved via a lookup query.
 *
 * @example
 * ```yaml
 * inject:
 *   - target: pullRequestId
 *     source: scalar
 *     path: repository.pullRequest.id
 * ```
 */
export interface ScalarInject {
  target: string
  source: "scalar"
  path: string
}

/**
 * Resolves a list of human-readable names to node IDs using a Phase 1 lookup result.
 *
 * Matching is case-insensitive. Use when the mutation needs an array of IDs
 * (e.g. label IDs, assignee IDs) that must be looked up by name.
 *
 * @example
 * ```yaml
 * inject:
 *   - target: labelIds
 *     source: map_array
 *     from_input: labels           # input field containing list of names
 *     nodes_path: repository.labels.nodes
 *     match_field: name            # field on each node to match against input names
 *     extract_field: id            # field on each node to extract as the resolved value
 * ```
 */
export interface MapArrayInject {
  target: string
  source: "map_array"
  from_input: string
  nodes_path: string
  match_field: string
  extract_field: string
}

/**
 * Passes a value directly from the step's `input` into a mutation variable.
 *
 * No Phase 1 lookup is required. Use when the caller already has the required node ID
 * (e.g. the agent passes `issueId` directly), avoiding an unnecessary resolution round-trip.
 *
 * @example
 * ```yaml
 * inject:
 *   - target: labelableId
 *     source: input
 *     from_input: issueId          # the input field whose value is passed through
 * ```
 */
export interface InputPassthroughInject {
  target: string
  source: "input"
  from_input: string
}

/**
 * Injects an explicit `null` value into a mutation variable.
 *
 * Use when a mutation variable must be explicitly set to `null` to clear a field
 * (e.g. clearing a milestone from an issue by passing `milestoneId: null`).
 *
 * @example
 * ```yaml
 * inject:
 *   - target: milestoneId
 *     source: "null_literal"
 * ```
 */
export interface NullLiteralInject {
  target: string
  source: "null_literal"
}

/** A specification for how to inject a resolved Phase 1 value into Phase 2. */
export type InjectSpec = ScalarInject | MapArrayInject | InputPassthroughInject | NullLiteralInject

/** Defines the GraphQL query to run during the Phase 1 lookup. */
export interface LookupSpec {
  operationName: string
  documentPath: string
  vars: Record<string, string>
}

/** Configuration for a Phase 1 node ID lookup prior to mutation execution. */
export interface ResolutionConfig {
  lookup: LookupSpec
  inject: InjectSpec[]
}

/**
 * Declarative configuration for a single ghx capability.
 *
 * Defines the capability's identity, input/output schemas, routing preferences,
 * and adapter-specific execution details (GraphQL, CLI, REST).
 */
export interface OperationCard<Input = Record<string, unknown>> {
  capability_id: string
  version: string
  description: string
  input_schema: JsonSchema
  output_schema: JsonSchema
  routing: {
    preferred: RouteSource
    fallbacks: RouteSource[]
    suitability?: SuitabilityRule[]
    notes?: string[]
  }
  graphql?: {
    operationName: string
    operationType: "query" | "mutation"
    documentPath: string
    variables?: Record<string, string>
    limits?: { maxPageSize?: number }
    resolution?: ResolutionConfig
  }
  cli?: {
    command: string
    jsonFields?: string[]
    jq?: string
    limits?: { maxItemsPerCall?: number }
  }
  rest?: {
    endpoints: Array<{ method: string; path: string }>
  }
  examples?: Array<{
    title: string
    input: Input
  }>
}

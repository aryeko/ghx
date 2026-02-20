import type { RouteSource } from "../contracts/envelope.js"

export type JsonSchema = Record<string, unknown>

export interface SuitabilityRule {
  when: "always" | "env" | "params"
  predicate: string
  reason: string
}

export interface ScalarInject {
  target: string
  source: "scalar"
  path: string
}

export interface MapArrayInject {
  target: string
  source: "map_array"
  from_input: string
  nodes_path: string
  match_field: string
  extract_field: string
}

export interface InputPassthroughInject {
  target: string
  source: "input"
  from_input: string
}

export type InjectSpec = ScalarInject | MapArrayInject | InputPassthroughInject

export interface ResolutionConfig {
  lookup: {
    operationName: string
    documentPath: string
    vars: Record<string, string>
  }
  inject: InjectSpec[]
}

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

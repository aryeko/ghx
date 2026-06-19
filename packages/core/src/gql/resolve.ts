import type { InjectSpec } from "@core/core/registry/types.js"
import type { GraphqlVariables } from "./transport.js"

function getAtPath(obj: unknown, path: string): unknown {
  const parts = path.split(".")
  let current = obj
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function applyInject(
  spec: InjectSpec,
  lookupResult: unknown,
  input: Record<string, unknown>,
): Record<string, unknown> {
  if (spec.source === "null_literal") {
    return { [spec.target]: null }
  }

  if (spec.source === "scalar") {
    const value = getAtPath(lookupResult, spec.path)
    if (value === undefined || value === null) {
      throw new Error(`Resolution failed for '${spec.target}': no value at path '${spec.path}'`)
    }
    return { [spec.target]: value }
  }

  if (spec.source === "first_scalar") {
    for (const candidate of spec.paths) {
      const candidateResult =
        candidate.from_lookup && lookupResult && typeof lookupResult === "object"
          ? (lookupResult as Record<string, unknown>)[candidate.from_lookup]
          : lookupResult
      const value = getAtPath(candidateResult, candidate.path)
      if (value !== undefined && value !== null) {
        return { [spec.target]: value }
      }
    }
    throw new Error(`Resolution failed for '${spec.target}': no candidate path had a value`)
  }

  if (spec.source === "input") {
    const value = input[spec.from_input]
    if (value === undefined || value === null) {
      throw new Error(
        `Resolution failed for '${spec.target}': no value at input field '${spec.from_input}'`,
      )
    }
    return { [spec.target]: value }
  }

  if (spec.source === "input_upper") {
    const value = input[spec.from_input]
    // Missing or null: leave the variable unset so the optional GraphQL variable
    // falls through to its server-side default (no error — value is not required).
    if (value === undefined || value === null) {
      return {}
    }
    if (typeof value !== "string") {
      throw new Error(
        `Resolution failed for '${spec.target}': input field '${spec.from_input}' must be a string for input_upper inject (got ${typeof value})`,
      )
    }
    return { [spec.target]: value.toUpperCase() }
  }

  if (spec.source === "input_present") {
    return {
      [spec.target]: input[spec.from_input] !== undefined && input[spec.from_input] !== null,
    }
  }

  if (spec.source === "input_default") {
    const value = input[spec.from_input]
    return { [spec.target]: value === undefined || value === null ? spec.default : value }
  }

  if (spec.source === "draft_review_threads") {
    const value = input[spec.from_input]
    if (value === undefined || value === null) {
      return {}
    }
    if (!Array.isArray(value)) {
      throw new Error(
        `Resolution failed for '${spec.target}': input field '${spec.from_input}' is not an array`,
      )
    }
    if (value.length === 0) {
      return {}
    }

    return {
      [spec.target]: value.map((comment) => {
        if (typeof comment !== "object" || comment === null || Array.isArray(comment)) {
          throw new Error(`Resolution failed for '${spec.target}': expected comment object`)
        }

        const record = comment as Record<string, unknown>
        const thread: Record<string, unknown> = {
          path: record.path,
          body: record.body,
          line: record.line,
        }
        if (record.side !== undefined) {
          if (typeof record.side !== "string") {
            throw new Error(`Resolution failed for '${spec.target}': side must be a string`)
          }
          thread.side = record.side.toUpperCase()
        }
        if (record.startLine !== undefined) {
          thread.startLine = record.startLine
        }
        if (record.startSide !== undefined) {
          if (typeof record.startSide !== "string") {
            throw new Error(`Resolution failed for '${spec.target}': startSide must be a string`)
          }
          thread.startSide = record.startSide.toUpperCase()
        }
        return thread
      }),
    }
  }

  if (spec.source === "project_v2_field_value") {
    if (
      input.clear === true &&
      (input.valueText !== undefined ||
        input.valueNumber !== undefined ||
        input.valueDate !== undefined ||
        input.valueSingleSelectOptionId !== undefined ||
        input.valueIterationId !== undefined)
    ) {
      throw new Error("Cannot set clear and a value field simultaneously")
    }
    if (input.clear === true) return { [spec.target]: {} }
    if (input.valueText !== undefined) return { [spec.target]: { text: input.valueText } }
    if (input.valueNumber !== undefined) return { [spec.target]: { number: input.valueNumber } }
    if (input.valueDate !== undefined) return { [spec.target]: { date: input.valueDate } }
    if (input.valueSingleSelectOptionId !== undefined) {
      return { [spec.target]: { singleSelectOptionId: input.valueSingleSelectOptionId } }
    }
    if (input.valueIterationId !== undefined) {
      return { [spec.target]: { iterationId: input.valueIterationId } }
    }
    throw new Error("At least one value field must be provided")
  }

  // map_array
  if (spec.source !== "map_array") {
    throw new Error(`Unknown inject source: '${(spec as InjectSpec).source}'`)
  }
  const nodes = getAtPath(lookupResult, spec.nodes_path)
  if (!Array.isArray(nodes)) {
    throw new Error(
      `Resolution failed for '${spec.target}': nodes at '${spec.nodes_path}' is not an array`,
    )
  }

  // Guard: if the lookup connection reported more pages, our 100-item cap may truncate results
  const pageInfoPath = spec.nodes_path.replace(/\.nodes$/, ".pageInfo.hasNextPage")
  if (getAtPath(lookupResult, pageInfoPath) === true) {
    throw new Error(
      `Resolution failed for '${spec.target}': lookup returned 100 items but more exist — request may be truncated. Narrow the scope or use a repository with fewer items.`,
    )
  }

  const idByName = new Map<string, unknown>()
  for (const node of nodes) {
    if (node && typeof node === "object") {
      const n = node as Record<string, unknown>
      const key = n[spec.match_field]
      const val = n[spec.extract_field]
      if (typeof key === "string") {
        idByName.set(key.toLowerCase(), val)
      }
    }
  }

  const inputValues = input[spec.from_input]
  if (!Array.isArray(inputValues)) {
    throw new Error(
      `Resolution failed for '${spec.target}': input field '${spec.from_input}' is not an array`,
    )
  }

  const resolved = inputValues.map((name: unknown) => {
    if (typeof name !== "string")
      throw new Error(`Resolution: expected string in '${spec.from_input}'`)
    const id = idByName.get(name.toLowerCase())
    if (id === undefined) throw new Error(`Resolution: '${name}' not found in lookup result`)
    return id
  })

  return { [spec.target]: resolved }
}

export function buildOperationVars(
  operationDoc: string,
  input: Record<string, unknown>,
  resolved: Record<string, unknown>,
  variableMappings?: Record<string, string>,
): GraphqlVariables {
  // Extract variable names declared in the mutation header
  const headerMatch = operationDoc.match(/(?:query|mutation)\s+\w+\s*\(([^)]*)\)/)
  const mutVarNames = new Set<string>()
  if (headerMatch?.[1]) {
    for (const match of headerMatch[1].matchAll(/\$(\w+)\s*:/g)) {
      if (match[1]) mutVarNames.add(match[1])
    }
  }

  const vars: GraphqlVariables = {}
  // Pass through input fields whose names match mutation variables
  for (const varName of mutVarNames) {
    if (varName in input) {
      vars[varName] = input[varName] as GraphqlVariables[string]
    }
  }
  for (const [varName, inputField] of Object.entries(variableMappings ?? {})) {
    if (mutVarNames.has(varName) && inputField in input) {
      vars[varName] = input[inputField] as GraphqlVariables[string]
    }
  }
  // Apply resolved values (may override pass-through)
  for (const [key, value] of Object.entries(resolved)) {
    if (mutVarNames.has(key)) {
      vars[key] = value as GraphqlVariables[string]
    }
  }
  return vars
}

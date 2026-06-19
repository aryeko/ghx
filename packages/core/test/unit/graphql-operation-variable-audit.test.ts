import { listOperationCards } from "@core/core/registry/index.js"
import type { InjectSpec, JsonSchema, OperationCard } from "@core/core/registry/types.js"
import { getDocument } from "@core/gql/document-registry.js"
import { describe, expect, it } from "vitest"

type VariableDeclaration = {
  name: string
  type: string
  hasDefault: boolean
}

function variableDeclarations(document: string): VariableDeclaration[] {
  const headerMatch = document.match(/(?:query|mutation)\s+\w+\s*\(([\s\S]*?)\)\s*\{/)
  if (!headerMatch?.[1]) return []

  return [...headerMatch[1].matchAll(/\$(\w+)\s*:\s*([![\]\w]+)(?:\s*=\s*([^,\n)]+))?/g)].map(
    (match) => ({
      name: String(match[1]),
      type: String(match[2]),
      hasDefault: match[3] !== undefined,
    }),
  )
}

function inputPropertySchema(card: OperationCard, name: string): JsonSchema | undefined {
  const properties = card.input_schema.properties
  if (typeof properties !== "object" || properties === null || Array.isArray(properties)) {
    return undefined
  }

  const schema = (properties as Record<string, unknown>)[name]
  return typeof schema === "object" && schema !== null && !Array.isArray(schema)
    ? (schema as JsonSchema)
    : undefined
}

function requiredInputFields(card: OperationCard): Set<string> {
  return new Set(
    Array.isArray(card.input_schema.required)
      ? card.input_schema.required.filter((field): field is string => typeof field === "string")
      : [],
  )
}

function injectTargets(card: OperationCard): Set<string> {
  return new Set((card.graphql?.resolution?.inject ?? []).map((spec: InjectSpec) => spec.target))
}

function variableMappings(card: OperationCard): Set<string> {
  return new Set(Object.keys(card.graphql?.variables ?? {}))
}

function isRequiredOrDefaultedInput(card: OperationCard, variableName: string): boolean {
  const property = inputPropertySchema(card, variableName)
  return requiredInputFields(card).has(variableName) || property?.default !== undefined
}

describe("GraphQL card variable contract audit", () => {
  it("has a declarative source for every non-null operation variable", () => {
    const failures: string[] = []

    for (const card of listOperationCards()) {
      if (!card.graphql) continue

      const document = getDocument(card.graphql.operationName)
      const mappedVariables = variableMappings(card)
      const resolvedTargets = injectTargets(card)

      for (const variable of variableDeclarations(document)) {
        if (!variable.type.endsWith("!") || variable.hasDefault) continue

        const supplied =
          isRequiredOrDefaultedInput(card, variable.name) ||
          resolvedTargets.has(variable.name) ||
          mappedVariables.has(variable.name)

        if (!supplied) {
          failures.push(`${card.capability_id}: $${variable.name}: ${variable.type}`)
        }
      }
    }

    expect(failures).toEqual([])
  })

  it("keeps declarative variable mappings, lookups, and injects internally consistent", () => {
    const failures: string[] = []

    for (const card of listOperationCards()) {
      if (!card.graphql) continue

      const document = getDocument(card.graphql.operationName)
      const operationVariables = new Set(variableDeclarations(document).map(({ name }) => name))
      const lookupIds = new Set<string>()

      for (const lookup of [
        ...(card.graphql.resolution?.lookup ? [card.graphql.resolution.lookup] : []),
        ...(card.graphql.resolution?.lookups ?? []),
      ]) {
        const lookupId = lookup.id ?? "default"
        if (lookupIds.has(lookupId)) {
          failures.push(`${card.capability_id}: duplicate lookup id '${lookupId}'`)
        }
        lookupIds.add(lookupId)

        for (const inputField of Object.values(lookup.vars)) {
          if (inputPropertySchema(card, inputField) === undefined) {
            failures.push(
              `${card.capability_id}: lookup '${lookupId}' references missing input '${inputField}'`,
            )
          }
        }
      }

      for (const [variableName, inputField] of Object.entries(card.graphql.variables ?? {})) {
        if (!operationVariables.has(variableName)) {
          failures.push(`${card.capability_id}: variables maps unknown $${variableName}`)
        }
        if (inputPropertySchema(card, inputField) === undefined) {
          failures.push(
            `${card.capability_id}: variables.$${variableName} uses missing input '${inputField}'`,
          )
        }
      }

      for (const inject of card.graphql.resolution?.inject ?? []) {
        if (!operationVariables.has(inject.target)) {
          failures.push(`${card.capability_id}: inject targets unknown $${inject.target}`)
        }

        if (inject.source === "input" || inject.source === "input_upper") {
          if (inputPropertySchema(card, inject.from_input) === undefined) {
            failures.push(
              `${card.capability_id}: inject $${inject.target} uses missing input '${inject.from_input}'`,
            )
          }
        }

        if (
          inject.source === "input_present" ||
          inject.source === "input_default" ||
          inject.source === "draft_review_threads" ||
          inject.source === "map_array"
        ) {
          if (inputPropertySchema(card, inject.from_input) === undefined) {
            failures.push(
              `${card.capability_id}: inject $${inject.target} uses missing input '${inject.from_input}'`,
            )
          }
        }

        if (inject.source === "scalar" || inject.source === "map_array") {
          const fromLookup = inject.from_lookup ?? "default"
          if (!lookupIds.has(fromLookup)) {
            failures.push(
              `${card.capability_id}: inject $${inject.target} references missing lookup '${fromLookup}'`,
            )
          }
        }

        if (inject.source === "first_scalar") {
          for (const candidate of inject.paths) {
            const fromLookup = candidate.from_lookup ?? "default"
            if (!lookupIds.has(fromLookup)) {
              failures.push(
                `${card.capability_id}: inject $${inject.target} references missing lookup '${fromLookup}'`,
              )
            }
          }
        }
      }
    }

    expect(failures).toEqual([])
  })
})

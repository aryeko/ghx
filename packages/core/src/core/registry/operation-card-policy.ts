import type { OperationCard } from "./types.js"

type ValidationResult = { ok: true } | { ok: false; error: string }

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function hasKey(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function isNullableStringSchema(value: unknown): boolean {
  const schema = asRecord(value)
  if (!schema) {
    return false
  }
  const type = schema.type
  return Array.isArray(type) && type.length === 2 && type[0] === "string" && type[1] === "null"
}

function isStandardFirstSchema(value: unknown): boolean {
  const schema = asRecord(value)
  return (
    schema?.type === "integer" &&
    schema.minimum === 1 &&
    schema.maximum === 100 &&
    schema.default === 30
  )
}

function isStandardPageInfoSchema(value: unknown): boolean {
  const schema = asRecord(value)
  const required = schema?.required
  const properties = asRecord(schema?.properties)
  const hasNextPage = asRecord(properties?.hasNextPage)

  return (
    schema?.type === "object" &&
    Array.isArray(required) &&
    required.length === 2 &&
    required[0] === "hasNextPage" &&
    required[1] === "endCursor" &&
    hasNextPage?.type === "boolean" &&
    isNullableStringSchema(properties?.endCursor) &&
    schema.additionalProperties === false
  )
}

function isStandardScanSchema(value: unknown): boolean {
  const schema = asRecord(value)
  const required = schema?.required
  const properties = asRecord(schema?.properties)
  const pagesScanned = asRecord(properties?.pagesScanned)
  const sourceItemsScanned = asRecord(properties?.sourceItemsScanned)
  const scanTruncated = asRecord(properties?.scanTruncated)

  return (
    schema?.type === "object" &&
    Array.isArray(required) &&
    required.length === 3 &&
    required[0] === "pagesScanned" &&
    required[1] === "sourceItemsScanned" &&
    required[2] === "scanTruncated" &&
    pagesScanned?.type === "integer" &&
    pagesScanned.minimum === 0 &&
    sourceItemsScanned?.type === "integer" &&
    sourceItemsScanned.minimum === 0 &&
    scanTruncated?.type === "boolean" &&
    schema.additionalProperties === false
  )
}

export function validateOperationCardPolicy(card: OperationCard): ValidationResult {
  const inputProperties = asRecord(card.input_schema.properties) ?? {}
  const outputProperties = asRecord(card.output_schema.properties) ?? {}

  if (hasKey(outputProperties, "pageInfo")) {
    if (!isStandardFirstSchema(inputProperties.first)) {
      return {
        ok: false,
        error: `${card.capability_id} exposes pageInfo and must define input first as { type: integer, minimum: 1, maximum: 100, default: 30 }`,
      }
    }

    if (!isNullableStringSchema(inputProperties.after)) {
      return {
        ok: false,
        error: `${card.capability_id} exposes pageInfo and must define input after as { type: [string, "null"] }`,
      }
    }

    if (!isStandardPageInfoSchema(outputProperties.pageInfo)) {
      return {
        ok: false,
        error: `${card.capability_id} exposes pageInfo and must define output pageInfo as { hasNextPage: boolean, endCursor: string | null }`,
      }
    }
  }

  if (hasKey(outputProperties, "scan") && !isStandardScanSchema(outputProperties.scan)) {
    return {
      ok: false,
      error: `${card.capability_id} defines scan and must use { pagesScanned, sourceItemsScanned, scanTruncated }`,
    }
  }

  return { ok: true }
}

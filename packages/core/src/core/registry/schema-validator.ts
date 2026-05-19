import type { ErrorObject, ValidateFunction } from "ajv"
import { ajv } from "./ajv-instance.js"

type SchemaValidationError = {
  instancePath: string
  message: string
  keyword: string
  params: Record<string, unknown>
}

function describeSuffix(error: SchemaValidationError): string {
  if (error.keyword === "enum") {
    const allowed = error.params.allowedValues
    if (Array.isArray(allowed) && allowed.every((value) => typeof value === "string")) {
      return ` (allowed: ${allowed.join(", ")})`
    }
    return ""
  }

  if (error.keyword === "type") {
    const expected = error.params.type
    if (typeof expected === "string") {
      return ` (expected: ${expected})`
    }
    if (Array.isArray(expected) && expected.every((value) => typeof value === "string")) {
      return ` (expected: ${expected.join(", ")})`
    }
    return ""
  }

  return ""
}

/**
 * Render an array of AJV-derived schema validation errors into a single
 * caller-friendly string. Each error contributes `${path}: ${message}${suffix}`,
 * where `suffix` annotates enum and type failures with the accepted values or
 * expected type so callers don't have to run `ghx capabilities explain` to
 * discover them. Multiple errors are joined with `"; "`.
 */
export function formatSchemaErrorDetails(errors: SchemaValidationError[]): string {
  return errors
    .map((error) => {
      const path = error.instancePath || "root"
      return `${path}: ${error.message}${describeSuffix(error)}`
    })
    .join("; ")
}

type SchemaValidationResult =
  | { ok: true }
  | {
      ok: false
      errors: SchemaValidationError[]
    }

const validatorCache = new WeakMap<Record<string, unknown>, ValidateFunction>()

function mapAjvErrors(errors: ErrorObject[] | null | undefined): SchemaValidationError[] {
  if (!errors) {
    return []
  }

  return errors.map((error) => ({
    instancePath: error.instancePath,
    message: error.message ?? "schema validation failed",
    keyword: error.keyword,
    params: error.params,
  }))
}

function getValidator(schema: Record<string, unknown>): ValidateFunction {
  const cached = validatorCache.get(schema)
  if (cached) {
    return cached
  }

  const validator = ajv.compile(schema)
  validatorCache.set(schema, validator)
  return validator
}

function validate(schema: Record<string, unknown>, payload: unknown): SchemaValidationResult {
  const validator = getValidator(schema)
  const ok = validator(payload)

  if (ok) {
    return { ok: true }
  }

  return {
    ok: false,
    errors: mapAjvErrors(validator.errors),
  }
}

export function validateInput(
  inputSchema: Record<string, unknown>,
  params: Record<string, unknown>,
): SchemaValidationResult {
  return validate(inputSchema, params)
}

export function validateOutput(
  outputSchema: Record<string, unknown>,
  data: unknown,
): SchemaValidationResult {
  return validate(outputSchema, data)
}

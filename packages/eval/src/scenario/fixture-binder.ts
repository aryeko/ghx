// FixtureBindings is the structural interface the binder requires from a fixture manifest.
// FixtureManifest from src/fixture/manifest.ts satisfies this interface — callers may
// pass a FixtureManifest directly.
export interface FixtureBindings {
  readonly fixtures: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

import type { EvalScenario } from "./schema.js"

/**
 * Resolves `{{variable}}` placeholders in a scenario's prompt and checkpoint
 * inputs using values from a fixture manifest.
 *
 * Special variables derived automatically from any `repo` binding:
 * - `{{owner}}` — owner portion of the `repo` binding value
 * - `{{repo_name}}` — repo-name portion of the `repo` binding value
 *
 * Numeric types are preserved when a checkpoint input field is a pure single-variable
 * substitution (i.e. the entire value is `"{{key}}"`). This allows integer fields
 * (e.g. `prNumber`) to pass JSON Schema validation without coercion.
 *
 * Returns a new scenario object; the input is not mutated.
 *
 * @param scenario - Scenario with unresolved `{{variable}}` placeholders
 * @param bindings - Fixture manifest entries keyed by fixture name
 * @returns New scenario with all resolvable placeholders substituted
 *
 * @example
 * ```typescript
 * import { bindFixtureVariables } from "@ghx-dev/eval"
 *
 * const bound = bindFixtureVariables(scenario, manifest)
 * // bound.prompt now has {{repo}} replaced with the actual repo value
 * ```
 */
export function bindFixtureVariables(
  scenario: EvalScenario,
  manifest: FixtureBindings,
): EvalScenario {
  if (!scenario.fixture) return scenario

  const { strings, raw } = resolveBindings(scenario.fixture.bindings, manifest)
  const prompt = interpolate(scenario.prompt, strings)
  const checkpoints = scenario.assertions.checkpoints.map((cp) => ({
    ...cp,
    input: interpolateRecord(cp.input, strings, raw),
  }))

  return {
    ...scenario,
    prompt,
    assertions: { ...scenario.assertions, checkpoints },
  }
}

interface ResolvedBindings {
  /** String representation of each binding value (for prompt/text interpolation). */
  readonly strings: Readonly<Record<string, string>>
  /** Raw manifest values (for checkpoint input fields that need native types). */
  readonly raw: Readonly<Record<string, unknown>>
}

function resolveBindings(
  bindings: Readonly<Record<string, string>>,
  manifest: FixtureBindings,
): ResolvedBindings {
  const strings: Record<string, string> = {}
  const raw: Record<string, unknown> = {}

  for (const [key, path] of Object.entries(bindings)) {
    const value = getNestedValue(manifest.fixtures, path)
    if (value === undefined) {
      throw new Error(`Fixture binding "${key}" could not be resolved from path "${path}"`)
    }
    strings[key] = String(value)
    raw[key] = value
  }

  // Derive owner/repo_name from any "repo" binding
  const repo = strings["repo"]
  if (repo !== undefined && repo.includes("/")) {
    const slashIndex = repo.indexOf("/")
    strings["owner"] = repo.slice(0, slashIndex)
    strings["repo_name"] = repo.slice(slashIndex + 1)
    raw["owner"] = strings["owner"]
    raw["repo_name"] = strings["repo_name"]
  }

  return { strings, raw }
}

function interpolate(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = values[key]
    if (value === undefined) {
      throw new Error(`Unresolved template variable: {{${key}}}`)
    }
    return value
  })
}

// Matches a string that is exactly a single {{variable}} with nothing else.
const PURE_TEMPLATE_RE = /^\{\{(\w+)\}\}$/

function interpolateRecord(
  record: Readonly<Record<string, unknown>>,
  strings: Readonly<Record<string, string>>,
  raw: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(record)) {
    if (typeof v === "string") {
      // Pure single-variable substitution: preserve the original manifest type
      // so numeric fields (e.g. prNumber: integer) pass JSON Schema validation.
      const match = PURE_TEMPLATE_RE.exec(v)
      if (match) {
        const key = match[1]
        result[k] = key !== undefined && key in raw ? raw[key] : interpolate(v, strings)
      } else {
        result[k] = interpolate(v, strings)
      }
    } else {
      result[k] = v
    }
  }
  return result
}

function getNestedValue(obj: Readonly<Record<string, unknown>>, path: string): unknown {
  const parts = path.split(".")
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

import { executeTask } from "@ghx-dev/core"
import type { WorkflowCheckpoint } from "../domain/types.js"
import { isObject } from "../util/guards.js"

export type CheckpointResult = {
  name: string
  passed: boolean
  data: unknown
}

function resolveCheckpointData(data: unknown, field?: string): unknown {
  const unwrapped =
    isObject(data) && "items" in data && Array.isArray((data as Record<string, unknown>).items)
      ? (data as Record<string, unknown>).items
      : data
  if (field && isObject(unwrapped)) {
    return (unwrapped as Record<string, unknown>)[field] ?? null
  }
  return unwrapped
}

export function evaluateCondition(
  condition: "empty" | "non_empty" | "count_gte" | "count_eq" | "field_equals",
  data: unknown,
  expectedValue?: unknown,
): boolean {
  switch (condition) {
    case "empty":
      return Array.isArray(data) ? data.length === 0 : data === null || data === undefined
    case "non_empty":
      return Array.isArray(data) ? data.length > 0 : data !== null && data !== undefined
    case "count_gte":
      return Array.isArray(data) && data.length >= Number(expectedValue)
    case "count_eq":
      return Array.isArray(data) && data.length === Number(expectedValue)
    case "field_equals": {
      if (!isObject(data) || !isObject(expectedValue)) {
        return false
      }
      const expected = expectedValue as Record<string, unknown>
      const actual = data as Record<string, unknown>
      return Object.entries(expected).every(
        ([key, value]) => JSON.stringify(actual[key]) === JSON.stringify(value),
      )
    }
    default:
      return false
  }
}

export async function evaluateCheckpoints(
  checkpoints: WorkflowCheckpoint[],
  resolvedBindings: Record<string, unknown>,
  githubToken: string,
): Promise<{ allPassed: boolean; results: CheckpointResult[] }> {
  const { createGithubClientFromToken } = await import("@ghx-dev/core")
  const githubClient = createGithubClientFromToken(githubToken)

  const results: CheckpointResult[] = []

  for (const checkpoint of checkpoints) {
    try {
      const verificationResult = await executeTask(
        {
          task: checkpoint.verification_task,
          input: checkpoint.verification_input,
        },
        {
          githubClient,
          githubToken,
          skipGhPreflight: true,
        },
      )

      const ok = verificationResult.ok === true
      const data = ok
        ? resolveCheckpointData(verificationResult.data, checkpoint.verification_field)
        : null

      const passed = ok
        ? evaluateCondition(checkpoint.condition, data, checkpoint.expected_value)
        : false

      results.push({ name: checkpoint.name, passed, data })
    } catch {
      results.push({
        name: checkpoint.name,
        passed: false,
        data: null,
      })
    }
  }

  const allPassed = results.every((c) => c.passed)
  return { allPassed, results }
}

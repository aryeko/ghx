import { describe, expect, it } from "vitest"
import { extractRubric } from "../../../src/contracts/judge-provider.js"
import type { BaseScenario } from "../../../src/types/scenario.js"

const makeScenario = (extensions: Record<string, unknown> = {}): BaseScenario => ({
  id: "test-scenario",
  name: "Test",
  description: "A test scenario",
  prompt: "Do something",
  timeoutMs: 60_000,
  allowedRetries: 0,
  tags: [],
  extensions,
})

describe("extractRubric", () => {
  it("returns undefined when no rubric in extensions", () => {
    expect(extractRubric(makeScenario())).toBeUndefined()
  })

  it("returns undefined when rubric is malformed", () => {
    expect(extractRubric(makeScenario({ rubric: "not-an-object" }))).toBeUndefined()
    expect(extractRubric(makeScenario({ rubric: { criteria: "not-array" } }))).toBeUndefined()
  })

  it("parses a valid rubric", () => {
    const rubric = {
      criteria: [{ id: "strategy-task-fit", description: "Was the approach proportionate?" }],
    }
    const result = extractRubric(makeScenario({ rubric }))
    expect(result).toEqual(rubric)
  })

  it("parses rubric with gradingInstructions", () => {
    const rubric = {
      criteria: [{ id: "test", description: "test" }],
      gradingInstructions: "Be strict",
    }
    const result = extractRubric(makeScenario({ rubric }))
    expect(result?.gradingInstructions).toBe("Be strict")
  })
})

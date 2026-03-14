import { describe, expect, it, vi } from "vitest"
import type { Scorer, ScorerContext, ScorerResult } from "../../../src/contracts/scorer.js"
import { CompositeScorer } from "../../../src/scorer/composite-scorer.js"
import type { BaseScenario } from "../../../src/types/scenario.js"

const makeScenario = (): BaseScenario => ({
  id: "test",
  name: "Test",
  description: "Test",
  prompt: "Do something",
  timeoutMs: 60_000,
  allowedRetries: 0,
  tags: [],
  extensions: {},
})

const makeContext = (): ScorerContext => ({
  agentOutput: "output",
  trace: null,
  mode: "test",
  model: "test",
  iteration: 0,
  metadata: {},
})

const makeScorer = (id: string, result: ScorerResult): Scorer => ({
  id,
  evaluate: vi.fn().mockResolvedValue(result),
})

const passResult: ScorerResult = {
  success: true,
  passed: 2,
  total: 2,
  outputValid: true,
  details: [
    { id: "check-1", description: "Check 1", passed: true },
    { id: "check-2", description: "Check 2", passed: true },
  ],
}

const failResult: ScorerResult = {
  success: false,
  passed: 0,
  total: 1,
  outputValid: true,
  details: [{ id: "check-3", description: "Check 3", passed: false }],
}

describe("CompositeScorer", () => {
  it("merges results from multiple scorers", async () => {
    const scorer = new CompositeScorer({
      scorers: [makeScorer("a", passResult), makeScorer("b", passResult)],
    })
    const result = await scorer.evaluate(makeScenario(), makeContext())
    expect(result.success).toBe(true)
    expect(result.passed).toBe(4)
    expect(result.total).toBe(4)
    expect(result.details).toHaveLength(4)
  })

  it("prefixes detail ids with scorer id", async () => {
    const scorer = new CompositeScorer({
      scorers: [makeScorer("checkpoint", passResult)],
    })
    const result = await scorer.evaluate(makeScenario(), makeContext())
    expect(result.details[0]?.id).toBe("checkpoint:check-1")
  })

  it("fails when any scorer fails (all_must_pass)", async () => {
    const scorer = new CompositeScorer({
      scorers: [makeScorer("a", passResult), makeScorer("b", failResult)],
    })
    const result = await scorer.evaluate(makeScenario(), makeContext())
    expect(result.success).toBe(false)
    expect(result.passed).toBe(2)
    expect(result.total).toBe(3)
  })

  it("catches scorer errors and continues", async () => {
    const throwingScorer: Scorer = {
      id: "broken",
      evaluate: vi.fn().mockRejectedValue(new Error("boom")),
    }
    const scorer = new CompositeScorer({
      scorers: [throwingScorer, makeScorer("ok", passResult)],
    })
    const result = await scorer.evaluate(makeScenario(), makeContext())
    expect(result.success).toBe(false)
    expect(result.details.some((d) => d.error?.includes("boom"))).toBe(true)
    expect(result.details.some((d) => d.id === "ok:check-1")).toBe(true)
  })

  it("reports outputValid false when any scorer reports invalid", async () => {
    const invalidResult: ScorerResult = { ...passResult, outputValid: false }
    const scorer = new CompositeScorer({
      scorers: [makeScorer("a", passResult), makeScorer("b", invalidResult)],
    })
    const result = await scorer.evaluate(makeScenario(), makeContext())
    expect(result.outputValid).toBe(false)
  })
})

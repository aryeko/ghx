import { generateScenarioPage } from "@profiler/reporter/scenario-page.js"
import { describe, expect, it } from "vitest"
import { makeProfileRow } from "./_make-profile-row.js"

describe("generateScenarioPage", () => {
  it("contains scenario ID in H1 heading", () => {
    const result = generateScenarioPage([], "my-scenario")
    expect(result).toContain("# Scenario: my-scenario")
  })

  it("renders iteration rows", () => {
    const rows = [
      makeProfileRow({ iteration: 0, mode: "fast", success: true }),
      makeProfileRow({ iteration: 1, mode: "fast", success: false }),
    ]
    const result = generateScenarioPage(rows, "s1")
    expect(result).toContain("| 0 | fast | yes |")
    expect(result).toContain("| 1 | fast | no |")
  })

  it("includes wall time, tokens, tool calls, and cost", () => {
    const rows = [
      makeProfileRow({
        timing: { wallMs: 2500, segments: [] },
        tokens: {
          input: 100,
          output: 50,
          reasoning: 20,
          cacheRead: 10,
          cacheWrite: 5,
          total: 200,
          active: 190,
        },
        toolCalls: { total: 7, byCategory: {}, failed: 0, retried: 0, errorRate: 0, records: [] },
        cost: { totalUsd: 0.1234, inputUsd: 0.05, outputUsd: 0.05, reasoningUsd: 0.02 },
      }),
    ]
    const result = generateScenarioPage(rows, "s1")
    expect(result).toContain("2500")
    expect(result).toContain("200")
    expect(result).toContain("| 7 |")
    expect(result).toContain("0.1234")
  })

  it("sorts by iteration then mode", () => {
    const rows = [
      makeProfileRow({ iteration: 1, mode: "b" }),
      makeProfileRow({ iteration: 0, mode: "b" }),
      makeProfileRow({ iteration: 0, mode: "a" }),
    ]
    const result = generateScenarioPage(rows, "s1")
    const lines = result.split("\n").filter((l) => l.startsWith("| 0") || l.startsWith("| 1"))
    expect(lines.length).toBe(3)
    // iteration 0 comes first
    expect(lines[0]).toContain("| a |")
    expect(lines[1]).toContain("| b |")
    expect(lines[2]).toContain("| 1 |")
  })

  it("renders table headers", () => {
    const result = generateScenarioPage([], "s1")
    expect(result).toContain(
      "| Iteration | Mode | Success | Wall (ms) | Tokens | Tool Calls | Cost (USD) |",
    )
  })
})

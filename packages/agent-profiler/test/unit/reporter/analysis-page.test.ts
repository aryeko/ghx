import { generateAnalysisPage } from "@profiler/reporter/analysis-page.js"
import type { ScenarioMetadata } from "@profiler/reporter/report-page.js"
import type { SessionAnalysisBundle } from "@profiler/types/trace.js"
import { describe, expect, it } from "vitest"

function makeBundle(overrides: Partial<SessionAnalysisBundle> = {}): SessionAnalysisBundle {
  return {
    sessionId: "ses_001",
    scenarioId: "s1",
    mode: "baseline",
    model: "test-model",
    results: {},
    ...overrides,
  }
}

describe("generateAnalysisPage", () => {
  it("contains H1 heading", () => {
    const result = generateAnalysisPage([])
    expect(result).toContain("# Session Analysis")
  })

  it("shows empty message when no analysis results", () => {
    const result = generateAnalysisPage([])
    expect(result).toContain("No session analysis data available.")
  })

  it("groups bundles by scenario with H2 headings", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      makeBundle({ scenarioId: "create-issue", mode: "baseline" }),
      makeBundle({ scenarioId: "create-pr", mode: "baseline" }),
    ]
    const result = generateAnalysisPage(bundles)
    expect(result).toContain("## create-issue")
    expect(result).toContain("## create-pr")
  })

  it("uses scenario metadata name and description when provided", () => {
    const bundles: readonly SessionAnalysisBundle[] = [makeBundle({ scenarioId: "create-issue" })]
    const metadata: readonly ScenarioMetadata[] = [
      { id: "create-issue", name: "Create Issue", description: "Creates a GH issue with labels" },
    ]
    const result = generateAnalysisPage(bundles, metadata)
    expect(result).toContain("## Create Issue")
    expect(result).toContain("> Creates a GH issue with labels")
  })

  it("falls back to scenario ID when no metadata", () => {
    const bundles: readonly SessionAnalysisBundle[] = [makeBundle({ scenarioId: "my-scenario" })]
    const result = generateAnalysisPage(bundles)
    expect(result).toContain("## my-scenario")
  })

  it("renders cross-mode table for number findings", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      makeBundle({
        scenarioId: "s1",
        mode: "baseline",
        results: {
          efficiency: {
            analyzer: "efficiency",
            findings: {
              total_turns: { type: "number", value: 5, unit: "turns" },
            },
            summary: "Efficiency analysis",
          },
        },
      }),
      makeBundle({
        scenarioId: "s1",
        mode: "ghx",
        results: {
          efficiency: {
            analyzer: "efficiency",
            findings: {
              total_turns: { type: "number", value: 3, unit: "turns" },
            },
            summary: "Efficiency analysis",
          },
        },
      }),
    ]
    const result = generateAnalysisPage(bundles)
    expect(result).toContain("### Efficiency")
    expect(result).toContain("| Metric | baseline | ghx |")
    expect(result).toContain("| total_turns | 5 turns | 3 turns |")
  })

  it("renders cross-mode table for ratio findings", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      makeBundle({
        scenarioId: "s1",
        mode: "baseline",
        results: {
          efficiency: {
            analyzer: "efficiency",
            findings: {
              success_rate: { type: "ratio", value: 0.85, label: "success rate" },
            },
            summary: "Efficiency",
          },
        },
      }),
      makeBundle({
        scenarioId: "s1",
        mode: "ghx",
        results: {
          efficiency: {
            analyzer: "efficiency",
            findings: {
              success_rate: { type: "ratio", value: 0.95, label: "success rate" },
            },
            summary: "Efficiency",
          },
        },
      }),
    ]
    const result = generateAnalysisPage(bundles)
    expect(result).toContain("85.0%")
    expect(result).toContain("95.0%")
  })

  it("filters out scalar rows where all modes have the same value", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      makeBundle({
        scenarioId: "s1",
        mode: "baseline",
        results: {
          efficiency: {
            analyzer: "efficiency",
            findings: {
              same_metric: { type: "number", value: 5, unit: "calls" },
            },
            summary: "Same across modes",
          },
        },
      }),
      makeBundle({
        scenarioId: "s1",
        mode: "ghx",
        results: {
          efficiency: {
            analyzer: "efficiency",
            findings: {
              same_metric: { type: "number", value: 5, unit: "calls" },
            },
            summary: "Same across modes",
          },
        },
      }),
    ]
    const result = generateAnalysisPage(bundles)
    expect(result).not.toContain("same_metric")
    expect(result).toContain("No notable differences across modes.")
  })

  it("filters out scalar rows where all modes are zero", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      makeBundle({
        scenarioId: "s1",
        mode: "baseline",
        results: {
          efficiency: {
            analyzer: "efficiency",
            findings: {
              zero_metric: { type: "number", value: 0, unit: "calls" },
            },
            summary: "All zeros",
          },
        },
      }),
      makeBundle({
        scenarioId: "s1",
        mode: "ghx",
        results: {
          efficiency: {
            analyzer: "efficiency",
            findings: {
              zero_metric: { type: "number", value: 0, unit: "calls" },
            },
            summary: "All zeros",
          },
        },
      }),
    ]
    const result = generateAnalysisPage(bundles)
    expect(result).not.toContain("zero_metric")
  })

  it("renders list findings in collapsible details blocks", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      makeBundle({
        scenarioId: "s1",
        mode: "baseline",
        results: {
          reasoning: {
            analyzer: "reasoning",
            findings: {
              key_decisions: {
                type: "list",
                values: ["Planning review replies", "Correcting API path"],
              },
            },
            summary: "Reasoning analysis",
          },
        },
      }),
      makeBundle({
        scenarioId: "s1",
        mode: "ghx",
        results: {
          reasoning: {
            analyzer: "reasoning",
            findings: {
              key_decisions: {
                type: "list",
                values: ["Executing ghx capability", "Verifying results"],
              },
            },
            summary: "Reasoning analysis",
          },
        },
      }),
    ]
    const result = generateAnalysisPage(bundles)
    expect(result).toContain("<details>")
    expect(result).toContain("<summary>key_decisions</summary>")
    expect(result).toContain("**baseline:** Planning review replies, Correcting API path")
    expect(result).toContain("**ghx:** Executing ghx capability, Verifying results")
    expect(result).toContain("</details>")
  })

  it("skips list details blocks when all modes have empty lists", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      makeBundle({
        scenarioId: "s1",
        mode: "baseline",
        results: {
          reasoning: {
            analyzer: "reasoning",
            findings: {
              empty_list: { type: "list", values: [] },
            },
            summary: "Nothing here",
          },
        },
      }),
      makeBundle({
        scenarioId: "s1",
        mode: "ghx",
        results: {
          reasoning: {
            analyzer: "reasoning",
            findings: {
              empty_list: { type: "list", values: [] },
            },
            summary: "Nothing here",
          },
        },
      }),
    ]
    const result = generateAnalysisPage(bundles)
    expect(result).not.toContain("empty_list")
  })

  it("renders table findings in collapsible details blocks per mode", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      makeBundle({
        scenarioId: "s1",
        mode: "baseline",
        results: {
          "tool-pattern": {
            analyzer: "tool-pattern",
            findings: {
              tool_breakdown: {
                type: "table",
                headers: ["Tool", "Count"],
                rows: [["bash", "8"]],
              },
            },
            summary: "Tool patterns",
          },
        },
      }),
      makeBundle({
        scenarioId: "s1",
        mode: "ghx",
        results: {
          "tool-pattern": {
            analyzer: "tool-pattern",
            findings: {
              tool_breakdown: {
                type: "table",
                headers: ["Tool", "Count"],
                rows: [["bash", "4"]],
              },
            },
            summary: "Tool patterns",
          },
        },
      }),
    ]
    const result = generateAnalysisPage(bundles)
    expect(result).toContain("<summary>tool_breakdown</summary>")
    expect(result).toContain("**baseline:**")
    expect(result).toContain("| bash | 8 |")
    expect(result).toContain("**ghx:**")
    expect(result).toContain("| bash | 4 |")
  })

  it("shows 'No notable differences' when scenario has no differentiating content", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      makeBundle({ scenarioId: "s1", mode: "baseline", results: {} }),
      makeBundle({ scenarioId: "s1", mode: "ghx", results: {} }),
    ]
    const result = generateAnalysisPage(bundles)
    expect(result).toContain("No notable differences across modes.")
  })

  it("uses analyzer display order: efficiency, tool-pattern, strategy, reasoning, error", () => {
    const findings = {
      some_metric: { type: "number" as const, value: 1, unit: "x" },
    }
    const makeBundleWithAnalyzers = (mode: string, value: number): SessionAnalysisBundle =>
      makeBundle({
        scenarioId: "s1",
        mode,
        results: {
          error: {
            analyzer: "error",
            findings: { some_metric: { ...findings.some_metric, value } },
            summary: "",
          },
          reasoning: {
            analyzer: "reasoning",
            findings: { some_metric: { ...findings.some_metric, value } },
            summary: "",
          },
          efficiency: {
            analyzer: "efficiency",
            findings: { some_metric: { ...findings.some_metric, value } },
            summary: "",
          },
          "tool-pattern": {
            analyzer: "tool-pattern",
            findings: { some_metric: { ...findings.some_metric, value } },
            summary: "",
          },
          strategy: {
            analyzer: "strategy",
            findings: { some_metric: { ...findings.some_metric, value } },
            summary: "",
          },
        },
      })

    const bundles: readonly SessionAnalysisBundle[] = [
      makeBundleWithAnalyzers("baseline", 1),
      makeBundleWithAnalyzers("ghx", 2),
    ]
    const result = generateAnalysisPage(bundles)

    const efficiencyIdx = result.indexOf("### Efficiency")
    const toolPatternIdx = result.indexOf("### Tool Patterns")
    const strategyIdx = result.indexOf("### Strategy")
    const reasoningIdx = result.indexOf("### Reasoning")
    const errorIdx = result.indexOf("### Errors")

    expect(efficiencyIdx).toBeLessThan(toolPatternIdx)
    expect(toolPatternIdx).toBeLessThan(strategyIdx)
    expect(strategyIdx).toBeLessThan(reasoningIdx)
    expect(reasoningIdx).toBeLessThan(errorIdx)
  })

  it("skips entire analyzer section when no findings render", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      makeBundle({
        scenarioId: "s1",
        mode: "baseline",
        results: {
          efficiency: {
            analyzer: "efficiency",
            findings: {
              same_val: { type: "number", value: 5, unit: "x" },
            },
            summary: "",
          },
          reasoning: {
            analyzer: "reasoning",
            findings: {
              diff_val: { type: "number", value: 10, unit: "tok" },
            },
            summary: "",
          },
        },
      }),
      makeBundle({
        scenarioId: "s1",
        mode: "ghx",
        results: {
          efficiency: {
            analyzer: "efficiency",
            findings: {
              same_val: { type: "number", value: 5, unit: "x" },
            },
            summary: "",
          },
          reasoning: {
            analyzer: "reasoning",
            findings: {
              diff_val: { type: "number", value: 20, unit: "tok" },
            },
            summary: "",
          },
        },
      }),
    ]
    const result = generateAnalysisPage(bundles)
    // Efficiency should be skipped (same values)
    expect(result).not.toContain("### Efficiency")
    // Reasoning should render (different values)
    expect(result).toContain("### Reasoning")
  })

  it("deduplicates list items across iterations", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      makeBundle({
        sessionId: "ses_001",
        scenarioId: "s1",
        mode: "baseline",
        results: {
          reasoning: {
            analyzer: "reasoning",
            findings: {
              decisions: { type: "list", values: ["Plan A", "Plan B"] },
            },
            summary: "",
          },
        },
      }),
      makeBundle({
        sessionId: "ses_002",
        scenarioId: "s1",
        mode: "baseline",
        results: {
          reasoning: {
            analyzer: "reasoning",
            findings: {
              decisions: { type: "list", values: ["Plan A", "Plan C"] },
            },
            summary: "",
          },
        },
      }),
      makeBundle({
        sessionId: "ses_003",
        scenarioId: "s1",
        mode: "ghx",
        results: {
          reasoning: {
            analyzer: "reasoning",
            findings: {
              decisions: { type: "list", values: ["Plan X"] },
            },
            summary: "",
          },
        },
      }),
    ]
    const result = generateAnalysisPage(bundles)
    // Should deduplicate "Plan A"
    const baselineMatch = result.match(/\*\*baseline:\*\* (.+)/)
    expect(baselineMatch).toBeTruthy()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- guarded by assertion above
    const baselineItems = baselineMatch![1]!.split(", ")
    expect(baselineItems).toContain("Plan A")
    expect(baselineItems).toContain("Plan B")
    expect(baselineItems).toContain("Plan C")
    // "Plan A" should only appear once
    expect(baselineItems.filter((i) => i === "Plan A")).toHaveLength(1)
  })

  it("renders string findings in cross-mode table", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      makeBundle({
        scenarioId: "s1",
        mode: "baseline",
        results: {
          strategy: {
            analyzer: "strategy",
            findings: {
              strategy_summary: { type: "string", value: "Direct approach" },
            },
            summary: "",
          },
        },
      }),
      makeBundle({
        scenarioId: "s1",
        mode: "ghx",
        results: {
          strategy: {
            analyzer: "strategy",
            findings: {
              strategy_summary: { type: "string", value: "Routed approach" },
            },
            summary: "",
          },
        },
      }),
    ]
    const result = generateAnalysisPage(bundles)
    expect(result).toContain("Direct approach")
    expect(result).toContain("Routed approach")
    expect(result).toContain("| strategy_summary")
  })
})

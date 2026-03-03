import { generateReportPage } from "@profiler/reporter/report-page.js"
import type { SessionAnalysisBundle } from "@profiler/types/trace.js"
import { describe, expect, it } from "vitest"
import { makeProfileRow } from "./_make-profile-row.js"

function makeContext(
  overrides: Partial<Parameters<typeof generateReportPage>[0]> = {},
): Parameters<typeof generateReportPage>[0] {
  return {
    runId: "run_test",
    rows: [makeProfileRow()],
    analysisResults: [],
    ...overrides,
  }
}

describe("generateReportPage", () => {
  it("renders the top-level heading", () => {
    const result = generateReportPage(makeContext())
    expect(result).toContain("# Eval Report")
  })

  it("renders all 9 sections", () => {
    const result = generateReportPage(makeContext())
    expect(result).toContain("## Run Summary")
    expect(result).toContain("## Results at a Glance")
    expect(result).toContain("## Statistical Comparison")
    expect(result).toContain("## Tool Usage Breakdown")
    expect(result).toContain("## Per-Scenario Results")
    expect(result).toContain("## Checkpoint Detail")
    expect(result).toContain("## Efficiency Analysis")
    expect(result).toContain("## Failures & Anomalies")
    expect(result).toContain("## Data Exports")
  })

  it("includes run ID in summary", () => {
    const result = generateReportPage(makeContext({ runId: "run_abc123" }))
    expect(result).toContain("run_abc123")
  })

  it("renders glance table with mode data", () => {
    const rows = [
      makeProfileRow({ mode: "fast", success: true }),
      makeProfileRow({ mode: "slow", success: false }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("fast")
    expect(result).toContain("slow")
    expect(result).toContain("100%")
    expect(result).toContain("0%")
  })

  it("renders metric glossary", () => {
    const result = generateReportPage(makeContext())
    expect(result).toContain("Metric Glossary")
    expect(result).toContain("Coefficient of variation")
  })

  it("renders statistical comparison for two modes", () => {
    const rows = [
      makeProfileRow({ mode: "a", timing: { wallMs: 1000, segments: [] } }),
      makeProfileRow({ mode: "a", timing: { wallMs: 1200, segments: [] } }),
      makeProfileRow({ mode: "b", timing: { wallMs: 2000, segments: [] } }),
      makeProfileRow({ mode: "b", timing: { wallMs: 2200, segments: [] } }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("### a vs b")
    expect(result).toContain("Wall Time")
    expect(result).toContain("Active Tokens")
    expect(result).toContain("Tool Calls")
    expect(result).toContain("Reduction")
    expect(result).toContain("Cohen's d")
    expect(result).toContain("p-value")
    // Notes at section start
    expect(result).toContain("> **Reduction:**")
    expect(result).toContain("> **p-value:**")
    expect(result).toContain("> **Cohen's d**")
  })

  it("shows single mode message for statistical comparison", () => {
    const result = generateReportPage(makeContext())
    expect(result).toContain("Single mode")
  })

  it("renders per-scenario results with iteration table", () => {
    const rows = [
      makeProfileRow({ scenarioId: "s1", iteration: 0, mode: "a", success: true }),
      makeProfileRow({ scenarioId: "s1", iteration: 1, mode: "a", success: false }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("### s1")
    expect(result).toContain("pass")
    expect(result).toContain("FAIL")
    expect(result).toContain("Success rate")
  })

  it("uses scenario metadata for names and descriptions", () => {
    const rows = [makeProfileRow({ scenarioId: "s1" })]
    const result = generateReportPage(
      makeContext({
        rows,
        scenarioMetadata: [{ id: "s1", name: "Create Issue", description: "Creates a GH issue" }],
      }),
    )
    expect(result).toContain("### Create Issue")
    expect(result).toContain("Creates a GH issue")
  })

  it("renders checkpoint detail when checkpointDetails exist", () => {
    const rows = [
      makeProfileRow({
        mode: "a",
        scenarioId: "s1",
        checkpointDetails: [
          { id: "cp1", description: "Issue exists", passed: true },
          { id: "cp2", description: "Label applied", passed: false },
        ],
      }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("`cp1`")
    expect(result).toContain("Issue exists")
    expect(result).toContain("`cp2`")
    expect(result).toContain("Label applied")
  })

  it("shows no checkpoint message when no details exist", () => {
    const result = generateReportPage(makeContext())
    expect(result).toContain("No checkpoint data available")
  })

  it("renders efficiency analysis from analysis bundles", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      {
        sessionId: "ses_1",
        scenarioId: "s1",
        mode: "fast",
        model: "test-model",
        results: {
          efficiency: {
            analyzer: "efficiency",
            summary: "Good efficiency",
            findings: {
              "turn efficiency": { type: "number", value: 0.85, unit: "ratio" },
            },
          },
        },
      },
    ]
    const result = generateReportPage(makeContext({ analysisResults: bundles }))
    expect(result).toContain("### fast")
    expect(result).toContain("efficiency: turn efficiency")
    expect(result).toContain("0.85")
  })

  it("shows no analysis message when no bundles", () => {
    const result = generateReportPage(makeContext())
    expect(result).toContain("No session analysis data available")
  })

  it("detects failures and anomalies", () => {
    const rows = [
      makeProfileRow({ success: false, mode: "a", scenarioId: "s1", iteration: 0 }),
      makeProfileRow({
        success: true,
        mode: "b",
        scenarioId: "s1",
        iteration: 0,
        completionReason: "timeout",
      }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("Failed (checkpoints not passed)")
    expect(result).toContain("Completion: timeout")
  })

  it("shows no anomalies message when all rows pass", () => {
    const rows = [makeProfileRow({ success: true })]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("No failures or anomalies detected")
  })

  it("renders data exports section with links", () => {
    const result = generateReportPage(makeContext())
    expect(result).toContain("data/results.json")
    expect(result).toContain("data/results.csv")
    expect(result).toContain("data/summary.json")
    expect(result).toContain("sessions/")
    expect(result).toContain("analysis/")
  })

  it("handles empty rows gracefully", () => {
    const result = generateReportPage(makeContext({ rows: [] }))
    expect(result).toContain("# Eval Report")
    expect(result).toContain("No data available")
  })

  it("renders tool usage from byCategory data", () => {
    const rows = [
      makeProfileRow({
        mode: "a",
        toolCalls: {
          total: 5,
          byCategory: { shell: 3, file: 2 },
          failed: 0,
          retried: 0,
          errorRate: 0,
          records: [],
        },
      }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("## Tool Usage Breakdown")
    expect(result).toContain("shell")
    expect(result).toContain("file")
  })
})

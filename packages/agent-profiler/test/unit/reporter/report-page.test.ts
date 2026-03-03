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

  it("renders cross-mode efficiency analysis with group headings", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      {
        sessionId: "ses_1",
        scenarioId: "s1",
        mode: "baseline",
        model: "test-model",
        results: {
          efficiency: {
            analyzer: "efficiency",
            summary: "Efficient",
            findings: {
              turn_efficiency: { type: "ratio", value: 1.0, label: "100%" },
              backtracking_events: { type: "number", value: 7, unit: "count" },
            },
          },
          reasoning: {
            analyzer: "reasoning",
            summary: "Good",
            findings: {
              reasoning_density: { type: "ratio", value: 0.006, label: "0.6%" },
              reasoning_per_tool_call: { type: "number", value: 116, unit: "tokens" },
            },
          },
        },
      },
      {
        sessionId: "ses_2",
        scenarioId: "s1",
        mode: "ghx",
        model: "test-model",
        results: {
          efficiency: {
            analyzer: "efficiency",
            summary: "Efficient",
            findings: {
              turn_efficiency: { type: "ratio", value: 1.0, label: "100%" },
              backtracking_events: { type: "number", value: 1, unit: "count" },
            },
          },
          reasoning: {
            analyzer: "reasoning",
            summary: "Good",
            findings: {
              reasoning_density: { type: "ratio", value: 0.006, label: "0.6%" },
              reasoning_per_tool_call: { type: "number", value: 183, unit: "tokens" },
            },
          },
        },
      },
    ]
    const result = generateReportPage(makeContext({ analysisResults: bundles }))

    // Cross-mode table with mode columns (not per-mode sections)
    expect(result).toContain("| baseline")
    expect(result).toContain("| ghx")

    // Group headings
    expect(result).toContain("### Behavioral Efficiency")
    expect(result).toContain("### Reasoning Quality")

    // Human-readable labels
    expect(result).toContain("Backtracking Events")
    expect(result).toContain("Reasoning / Tool Call")

    // Filtered: turn_efficiency is the same (100%) across both modes, should be absent
    expect(result).not.toContain("Turn Efficiency")

    // Reasoning density same (1%) across both modes — filtered out
    expect(result).not.toContain("Reasoning Density")
  })

  it("filters out rows where all modes have zero values", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      {
        sessionId: "ses_1",
        scenarioId: "s1",
        mode: "a",
        model: "test-model",
        results: {
          efficiency: {
            analyzer: "efficiency",
            summary: "Ok",
            findings: {
              information_redundancy: { type: "ratio", value: 0, label: "0%" },
              backtracking_events: { type: "number", value: 3, unit: "count" },
            },
          },
        },
      },
      {
        sessionId: "ses_2",
        scenarioId: "s1",
        mode: "b",
        model: "test-model",
        results: {
          efficiency: {
            analyzer: "efficiency",
            summary: "Ok",
            findings: {
              information_redundancy: { type: "ratio", value: 0, label: "0%" },
              backtracking_events: { type: "number", value: 5, unit: "count" },
            },
          },
        },
      },
    ]
    const result = generateReportPage(makeContext({ analysisResults: bundles }))

    // Zero across both modes — filtered out
    expect(result).not.toContain("Redundant Calls")

    // Different values — kept
    expect(result).toContain("Backtracking Events")
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

  it("includes color indicators in glance table", () => {
    const rows = [
      makeProfileRow({ mode: "good", success: true }),
      makeProfileRow({ mode: "bad", success: false }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    // Green circle for 100% success
    expect(result).toContain("\u{1F7E2} 100%")
    // Red circle for 0% success
    expect(result).toContain("\u{1F534} 0%")
  })

  it("includes color indicators in per-scenario pass/fail", () => {
    const rows = [
      makeProfileRow({ scenarioId: "s1", iteration: 0, success: true }),
      makeProfileRow({ scenarioId: "s1", iteration: 1, success: false }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("\u{1F7E2} pass")
    expect(result).toContain("\u{1F534} FAIL")
  })

  it("includes color indicators in checkpoint pass rates", () => {
    const rows = [
      makeProfileRow({
        mode: "a",
        scenarioId: "s1",
        checkpointDetails: [{ id: "cp1", description: "All pass", passed: true }],
      }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("\u{1F7E2} 100%")
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

  it("renders tool usage from extension keys when present", () => {
    const rows = [
      makeProfileRow({
        mode: "a",
        extensions: {
          "ghx.capabilities_used": 5,
          "ghx.gh_cli_commands": 3,
          "ghx.bash_commands": 2,
          "ghx.mcp_tools_invoked": 0,
          "ghx.file_ops": 1,
          "ghx.other_tools": 0,
        },
      }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("GHX Capabilities")
    expect(result).toContain("GH CLI Commands")
    expect(result).toContain("Description")
  })

  it("shows no tool category data when byCategory is empty", () => {
    const rows = [
      makeProfileRow({
        mode: "a",
        toolCalls: {
          total: 0,
          byCategory: {},
          failed: 0,
          retried: 0,
          errorRate: 0,
          records: [],
        },
      }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("No tool category data available")
  })

  it("uses startedAt from rows for date instead of current date", () => {
    const rows = [
      makeProfileRow({ startedAt: "2025-06-15T10:00:00.000Z" }),
      makeProfileRow({ startedAt: "2025-06-14T08:00:00.000Z" }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("2025-06-14")
    expect(result).not.toContain("unknown")
  })

  it("shows unknown date when rows are empty", () => {
    const result = generateReportPage(makeContext({ rows: [] }))
    expect(result).toContain("unknown")
  })

  it("renders yellow warning indicator for medium success rate", () => {
    const rows = [
      makeProfileRow({ mode: "warn", success: true }),
      makeProfileRow({ mode: "warn", success: true }),
      makeProfileRow({ mode: "warn", success: true }),
      makeProfileRow({ mode: "warn", success: false }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    // 75% success -> yellow warning
    expect(result).toContain("\u{1F7E1} 75%")
  })

  it("renders yellow warning indicator for failed calls between 1-3", () => {
    const rows = [
      makeProfileRow({
        mode: "a",
        toolCalls: {
          total: 5,
          byCategory: {},
          failed: 2,
          retried: 0,
          errorRate: 0.4,
          records: [],
        },
      }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("\u{1F7E1} 2")
  })

  it("renders red indicator for more than 3 failed calls", () => {
    const rows = [
      makeProfileRow({
        mode: "a",
        toolCalls: {
          total: 10,
          byCategory: {},
          failed: 5,
          retried: 0,
          errorRate: 0.5,
          records: [],
        },
      }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("\u{1F534} 5")
  })

  it("aggregates checkpoints across multiple modes", () => {
    const rows = [
      makeProfileRow({
        mode: "a",
        scenarioId: "s1",
        checkpointDetails: [{ id: "cp1", description: "Issue exists", passed: true }],
      }),
      makeProfileRow({
        mode: "b",
        scenarioId: "s1",
        checkpointDetails: [{ id: "cp1", description: "Issue exists", passed: false }],
      }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("`cp1`")
    expect(result).toContain("100%")
    expect(result).toContain("0%")
  })

  it("renders checkpoint yellow indicator for 50% pass rate", () => {
    const rows = [
      makeProfileRow({
        mode: "a",
        scenarioId: "s1",
        checkpointDetails: [{ id: "cp1", description: "Check", passed: true }],
      }),
      makeProfileRow({
        mode: "a",
        scenarioId: "s1",
        checkpointDetails: [{ id: "cp1", description: "Check", passed: false }],
      }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("\u{1F7E1} 50%")
  })

  it("renders error details with error message", () => {
    const rows = [
      makeProfileRow({
        success: false,
        error: "Token limit exceeded",
      }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("Error: Token limit exceeded")
  })

  it("formats large numbers with k suffix in glance table", () => {
    const rows = [
      makeProfileRow({
        mode: "a",
        tokens: {
          input: 5000,
          output: 3000,
          reasoning: 1000,
          cacheRead: 500,
          cacheWrite: 200,
          total: 9000,
          active: 8000,
        },
      }),
    ]
    const result = generateReportPage(makeContext({ rows }))
    expect(result).toContain("8.0k")
  })

  it("renders no notable differences when all efficiency metrics are the same", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      {
        sessionId: "ses_1",
        scenarioId: "s1",
        mode: "a",
        model: "test-model",
        results: {
          efficiency: {
            analyzer: "efficiency",
            summary: "Ok",
            findings: {
              turn_efficiency: { type: "ratio", value: 1.0, label: "100%" },
            },
          },
        },
      },
      {
        sessionId: "ses_2",
        scenarioId: "s1",
        mode: "b",
        model: "test-model",
        results: {
          efficiency: {
            analyzer: "efficiency",
            summary: "Ok",
            findings: {
              turn_efficiency: { type: "ratio", value: 1.0, label: "100%" },
            },
          },
        },
      },
    ]
    const result = generateReportPage(makeContext({ analysisResults: bundles }))
    expect(result).toContain("No notable differences across modes")
  })

  it("renders strategy group with string findings", () => {
    const bundles: readonly SessionAnalysisBundle[] = [
      {
        sessionId: "ses_1",
        scenarioId: "s1",
        mode: "a",
        model: "test-model",
        results: {
          strategy: {
            analyzer: "strategy",
            summary: "Methodical",
            findings: {
              strategy_summary: { type: "string", value: "methodical" },
            },
          },
        },
      },
      {
        sessionId: "ses_2",
        scenarioId: "s1",
        mode: "b",
        model: "test-model",
        results: {
          strategy: {
            analyzer: "strategy",
            summary: "Exploratory",
            findings: {
              strategy_summary: { type: "string", value: "exploratory" },
            },
          },
        },
      },
    ]
    const result = generateReportPage(makeContext({ analysisResults: bundles }))
    expect(result).toContain("Strategy Profile")
    expect(result).toContain("methodical")
    expect(result).toContain("exploratory")
  })
})

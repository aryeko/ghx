import { computeDescriptive } from "@profiler/stats/descriptive.js"
import type { ProfileRow } from "@profiler/types/profile-row.js"
import type { AnalysisFinding, SessionAnalysisBundle } from "@profiler/types/trace.js"
import { computePairwiseComparisons } from "./comparison-page.js"

/** Metadata for a scenario, optionally provided by the eval layer. */
export interface ScenarioMetadata {
  readonly id: string
  readonly name?: string
  readonly description?: string
}

/** Context needed to generate the unified report. */
export interface ReportPageContext {
  readonly runId: string
  readonly rows: readonly ProfileRow[]
  readonly analysisResults: readonly SessionAnalysisBundle[]
  readonly scenarioMetadata?: readonly ScenarioMetadata[]
}

/**
 * Generate a single unified Markdown report containing all profiling data.
 *
 * Produces 9 sections: Run Summary, Results at a Glance, Statistical Comparison,
 * Tool Usage Breakdown, Per-Scenario Results, Checkpoint Detail, Efficiency Analysis,
 * Failures & Anomalies, and Data Exports.
 */
export function generateReportPage(ctx: ReportPageContext): string {
  const { runId, rows, analysisResults, scenarioMetadata } = ctx
  const sections: string[] = []

  sections.push(...renderRunSummary(rows, runId))
  sections.push(...renderGlanceSection(rows))
  sections.push(...renderStatisticalComparison(rows))
  sections.push(...renderToolUsageBreakdown(rows))
  sections.push(...renderPerScenarioResults(rows, scenarioMetadata))
  sections.push(...renderCheckpointDetail(rows, scenarioMetadata))
  sections.push(...renderEfficiencyAnalysis(analysisResults))
  sections.push(...renderFailuresAndAnomalies(rows))
  sections.push(...renderDataExports())

  return sections.join("\n")
}

// ── Section 1: Run Summary ──────────────────────────────────────────────────

function renderRunSummary(rows: readonly ProfileRow[], runId: string): readonly string[] {
  const modes = [...new Set(rows.map((r) => r.mode))]
  const scenarios = [...new Set(rows.map((r) => r.scenarioId))]
  const models = [...new Set(rows.map((r) => r.model))]
  const providers = [...new Set(rows.map((r) => r.provider))]
  const iterations = rows.length > 0 ? Math.max(...rows.map((r) => r.iteration)) + 1 : 0

  return [
    "# Eval Report",
    "",
    "## Run Summary",
    "",
    "| Property | Value |",
    "| --- | --- |",
    `| Run ID | \`${runId}\` |`,
    `| Date | ${new Date().toISOString().split("T")[0]} |`,
    `| Model | ${models.join(", ")} |`,
    `| Provider | ${providers.join(", ")} |`,
    `| Modes | ${modes.join(", ")} |`,
    `| Scenarios | ${scenarios.length} |`,
    `| Iterations | ${iterations} |`,
    `| Total Rows | ${rows.length} |`,
    "",
  ]
}

// ── Section 2: Results at a Glance ──────────────────────────────────────────

function renderGlanceSection(rows: readonly ProfileRow[]): readonly string[] {
  const modes = [...new Set(rows.map((r) => r.mode))]
  if (modes.length === 0) return ["## Results at a Glance", "", "No data available.", ""]

  const lines: string[] = [
    "## Results at a Glance",
    "",
    [
      "| Mode",
      "| Success",
      "| Wall p50",
      "| Wall p90",
      "| Wall CV",
      "| Active Tok p50",
      "| Cache Read p50",
      "| Cache Ratio",
      "| Total Tok p50",
      "| Reasoning Tok p50",
      "| Tool Calls p50",
      "| Tool Calls Max",
      "| Failed Calls",
      "| Agent Turns p50",
      "| Cost p50 |",
    ].join(" "),
    [
      "| ---",
      "| ---",
      "| ---",
      "| ---",
      "| ---",
      "| ---",
      "| ---",
      "| ---",
      "| ---",
      "| ---",
      "| ---",
      "| ---",
      "| ---",
      "| ---",
      "| --- |",
    ].join(" "),
  ]

  for (const mode of modes) {
    lines.push(renderGlanceRow(rows, mode))
  }

  lines.push("", ...renderMetricGlossary(), "")

  return lines
}

function renderGlanceRow(rows: readonly ProfileRow[], mode: string): string {
  const modeRows = rows.filter((r) => r.mode === mode)
  const successCount = modeRows.filter((r) => r.success).length
  const successRate = modeRows.length === 0 ? 0 : (successCount / modeRows.length) * 100

  const wall = computeDescriptive(modeRows.map((r) => r.timing.wallMs))
  const active = computeDescriptive(modeRows.map((r) => r.tokens.active))
  const cacheRead = computeDescriptive(modeRows.map((r) => r.tokens.cacheRead))
  const total = computeDescriptive(modeRows.map((r) => r.tokens.total))
  const reasoning = computeDescriptive(modeRows.map((r) => r.tokens.reasoning))
  const tools = computeDescriptive(modeRows.map((r) => r.toolCalls.total))
  const turns = computeDescriptive(modeRows.map((r) => r.agentTurns))
  const cost = computeDescriptive(modeRows.map((r) => r.cost.totalUsd))

  const totalFailed = modeRows.reduce((sum, r) => sum + r.toolCalls.failed, 0)
  const maxTools = modeRows.length > 0 ? Math.max(...modeRows.map((r) => r.toolCalls.total)) : 0

  const totalTokensSum = modeRows.reduce((sum, r) => sum + r.tokens.total, 0)
  const cacheReadSum = modeRows.reduce((sum, r) => sum + r.tokens.cacheRead, 0)
  const cacheRatio = totalTokensSum === 0 ? 0 : (cacheReadSum / totalTokensSum) * 100

  return [
    `| ${mode}`,
    `| ${successIndicator(successRate)} ${successRate.toFixed(0)}%`,
    `| ${fmtMs(wall.median)}`,
    `| ${fmtMs(wall.p90)}`,
    `| ${cvIndicator(wall.cv)} ${wall.cv.toFixed(2)}`,
    `| ${fmtNum(active.median)}`,
    `| ${fmtNum(cacheRead.median)}`,
    `| ${cacheRatio.toFixed(0)}%`,
    `| ${fmtNum(total.median)}`,
    `| ${fmtNum(reasoning.median)}`,
    `| ${fmtNum(tools.median)}`,
    `| ${maxTools}`,
    `| ${failedCallsIndicator(totalFailed)} ${totalFailed}`,
    `| ${fmtNum(turns.median)}`,
    `| $${cost.median.toFixed(4)} |`,
  ].join(" ")
}

function renderMetricGlossary(): readonly string[] {
  return [
    "",
    "<details>",
    "<summary>Metric Glossary</summary>",
    "",
    "| Metric | Description |",
    "| --- | --- |",
    "| Success | Percentage of iterations where all checkpoints passed |",
    "| Wall p50/p90 | Median and 90th percentile wall-clock time in seconds |",
    "| Wall CV | Coefficient of variation for wall-clock time (stddev/mean); lower = more consistent |",
    "| Active Tok p50 | Median active tokens (input + output, excluding cache) |",
    "| Cache Read p50 | Median cache-read tokens per iteration |",
    "| Cache Ratio | Total cache-read tokens / total tokens across all iterations |",
    "| Total Tok p50 | Median total tokens (input + output + reasoning + cache) |",
    "| Reasoning Tok p50 | Median reasoning/thinking tokens per iteration |",
    "| Tool Calls p50/Max | Median and maximum tool calls per iteration |",
    "| Failed Calls | Total failed tool calls across all iterations in this mode |",
    "| Agent Turns p50 | Median number of agent conversation turns |",
    "| Cost p50 | Median cost per iteration in USD |",
    "",
    "</details>",
  ]
}

// ── Section 3: Statistical Comparison ───────────────────────────────────────

function renderStatisticalComparison(rows: readonly ProfileRow[]): readonly string[] {
  const modes = [...new Set(rows.map((r) => r.mode))]
  if (modes.length < 2) {
    return ["## Statistical Comparison", "", "Single mode — no comparison available.", ""]
  }

  const lines: string[] = [
    "## Statistical Comparison",
    "",
    "> **Reduction:** A positive value means mode A used fewer resources than mode B. Negative means mode B was more efficient.",
    "",
    "> **p-value:** Values below 0.05 indicate the observed difference is unlikely due to random chance alone, suggesting a real performance difference between the modes.",
    "",
    "> **Cohen's d** quantifies how large the difference is in practice, independent of sample size. Values are classified as negligible (<0.2), small (0.2-0.5), medium (0.5-0.8), or large (>0.8). A large effect size means the distributions barely overlap.",
    "",
    "> **95% CI** is a bootstrap confidence interval for the reduction percentage — if the interval excludes zero, the difference is robust.",
    "",
  ]

  const metricsToCompare: ReadonlyArray<{
    name: string
    metric: string
    extract: (r: ProfileRow) => number
    unit: string
  }> = [
    { name: "Wall Time", metric: "wallMs", extract: (r) => r.timing.wallMs, unit: "ms" },
    {
      name: "Active Tokens",
      metric: "activeTokens",
      extract: (r) => r.tokens.active,
      unit: "tokens",
    },
    {
      name: "Tool Calls",
      metric: "toolCalls",
      extract: (r) => r.toolCalls.total,
      unit: "calls",
    },
  ]

  // Pre-compute all comparisons keyed by mode pair
  const pairResults = new Map<
    string,
    ReadonlyArray<{
      name: string
      unit: string
      comparison: (typeof metricsToCompare)[number] extends infer T ? T : never
      result: ReturnType<typeof computePairwiseComparisons>[number]
    }>
  >()

  for (const m of metricsToCompare) {
    const comparisons = computePairwiseComparisons(rows, m.metric, m.extract)
    for (const c of comparisons) {
      const key = `${c.modeA} vs ${c.modeB}`
      const existing = pairResults.get(key) ?? []
      pairResults.set(key, [...existing, { name: m.name, unit: m.unit, comparison: m, result: c }])
    }
  }

  for (const [pairLabel, metrics] of pairResults) {
    lines.push(`### ${pairLabel}`, "")

    const first = metrics[0]
    if (!first) continue

    lines.push(
      "| Metric | Median A | Median B | Reduction | 95% CI | Cohen's d | p-value |",
      "| --- | --- | --- | --- | --- | --- | --- |",
    )

    for (const { name, unit, result: r } of metrics) {
      const ci0 = r.comparison.ci95[0] ?? 0
      const ci1 = r.comparison.ci95[1] ?? 0
      lines.push(
        [
          `| ${name}`,
          `| ${fmtStat(r.statsA.median, unit)}`,
          `| ${fmtStat(r.statsB.median, unit)}`,
          `| ${r.comparison.reductionPct.toFixed(1)}%`,
          `| ${ciIndicator(ci0, ci1)} [${ci0.toFixed(1)}%, ${ci1.toFixed(1)}%]`,
          `| ${effectIndicator(r.comparison.effectMagnitude)} ${r.comparison.effectSize.toFixed(3)} (${r.comparison.effectMagnitude})`,
          `| ${pValueIndicator(r.comparison.pValue)} ${r.comparison.pValue.toFixed(4)} |`,
        ].join(" "),
      )
    }

    lines.push("")
  }

  return lines
}

// ── Section 4: Tool Usage Breakdown ─────────────────────────────────────────

function renderToolUsageBreakdown(rows: readonly ProfileRow[]): readonly string[] {
  const modes = [...new Set(rows.map((r) => r.mode))]
  if (modes.length === 0) return ["## Tool Usage Breakdown", "", "No data available.", ""]

  const extensionKeys = [
    { key: "ghx.capabilities_used", label: "GHX Capabilities" },
    { key: "ghx.mcp_tools_invoked", label: "MCP Tools" },
    { key: "ghx.gh_cli_commands", label: "GH CLI Commands" },
    { key: "ghx.bash_commands", label: "Bash Commands" },
    { key: "ghx.file_ops", label: "File Operations" },
    { key: "ghx.other_tools", label: "Other Tools" },
  ] as const

  const hasExtensions = rows.some((r) =>
    extensionKeys.some(({ key }) => {
      const val = r.extensions[key]
      return val !== undefined && val !== null && val !== 0
    }),
  )

  const lines: string[] = ["## Tool Usage Breakdown", ""]

  if (!hasExtensions) {
    // Fall back to byCategory data from toolCalls
    const header = ["| Mode", ...modes.map((m) => `| ${m}`), "|"].join(" ")
    const sep = ["| ---", ...modes.map(() => "| ---"), "|"].join(" ")

    // Collect all categories across modes
    const allCategories = new Set<string>()
    for (const row of rows) {
      for (const cat of Object.keys(row.toolCalls.byCategory)) {
        allCategories.add(cat)
      }
    }

    if (allCategories.size === 0) {
      lines.push("No tool category data available.", "")
      return lines
    }

    lines.push(header, sep)
    for (const cat of [...allCategories].sort()) {
      const cells = modes.map((mode) => {
        const modeRows = rows.filter((r) => r.mode === mode)
        const values = modeRows.map((r) => r.toolCalls.byCategory[cat] ?? 0)
        const stats = computeDescriptive(values)
        return `| ${fmtNum(stats.median)}`
      })
      lines.push(`| ${cat} ${cells.join(" ")} |`)
    }
    lines.push("")

    return lines
  }

  const header = ["| Metric", ...modes.map((m) => `| ${m} p50`), "| Description |"].join(" ")
  const sep = ["| ---", ...modes.map(() => "| ---"), "| --- |"].join(" ")
  lines.push(header, sep)

  for (const { key, label } of extensionKeys) {
    const cells = modes.map((mode) => {
      const modeRows = rows.filter((r) => r.mode === mode)
      const values = modeRows.map((r) => {
        const val = r.extensions[key]
        return typeof val === "number" ? val : 0
      })
      const stats = computeDescriptive(values)
      return `| ${fmtNum(stats.median)}`
    })
    lines.push(`| ${label} ${cells.join(" ")} | ${toolDescription(key)} |`)
  }

  lines.push("")
  return lines
}

function toolDescription(key: string): string {
  const descriptions: Record<string, string> = {
    "ghx.capabilities_used": "GHX routing engine capability invocations",
    "ghx.mcp_tools_invoked": "MCP tool server calls",
    "ghx.gh_cli_commands": "GitHub CLI (gh) commands executed",
    "ghx.bash_commands": "Shell commands executed",
    "ghx.file_ops": "File read/write/edit operations",
    "ghx.other_tools": "Other tool invocations",
  }
  return descriptions[key] ?? ""
}

// ── Section 5: Per-Scenario Results ─────────────────────────────────────────

function renderPerScenarioResults(
  rows: readonly ProfileRow[],
  scenarioMetadata?: readonly ScenarioMetadata[],
): readonly string[] {
  const scenarioIds = [...new Set(rows.map((r) => r.scenarioId))]
  if (scenarioIds.length === 0) return ["## Per-Scenario Results", "", "No scenarios.", ""]

  const metadataMap = new Map((scenarioMetadata ?? []).map((s) => [s.id, s]))
  const lines: string[] = ["## Per-Scenario Results", ""]

  for (const id of scenarioIds) {
    const meta = metadataMap.get(id)
    const scenarioRows = rows.filter((r) => r.scenarioId === id)
    const successCount = scenarioRows.filter((r) => r.success).length
    const successRate = scenarioRows.length === 0 ? 0 : (successCount / scenarioRows.length) * 100
    const checkpointCount =
      scenarioRows.length > 0 ? Math.max(...scenarioRows.map((r) => r.checkpointsTotal)) : 0

    lines.push(`### ${meta?.name ?? id}`, "")

    if (meta?.description) {
      lines.push(`> ${meta.description}`, "")
    }

    lines.push(
      `- **Checkpoints:** ${checkpointCount}`,
      `- **Success rate:** ${successIndicator(successRate)} ${successRate.toFixed(0)}% (${successCount}/${scenarioRows.length})`,
      "",
    )

    const sorted = [...scenarioRows].sort((a, b) =>
      a.iteration !== b.iteration ? a.iteration - b.iteration : a.mode.localeCompare(b.mode),
    )

    lines.push(
      "| Iter | Mode | Success | Wall (s) | Active Tok | Cache Read | Tool Calls | Turns | Cost |",
      "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    )

    for (const r of sorted) {
      lines.push(
        [
          `| ${r.iteration}`,
          `| ${r.mode}`,
          `| ${r.success ? `${GOOD} pass` : `${BAD} FAIL`}`,
          `| ${fmtMs(r.timing.wallMs)}`,
          `| ${fmtNum(r.tokens.active)}`,
          `| ${fmtNum(r.tokens.cacheRead)}`,
          `| ${r.toolCalls.total}`,
          `| ${r.agentTurns}`,
          `| $${r.cost.totalUsd.toFixed(4)} |`,
        ].join(" "),
      )
    }

    lines.push("")
  }

  return lines
}

// ── Section 6: Checkpoint Detail ────────────────────────────────────────────

interface AggregatedCheckpoint {
  readonly id: string
  readonly description: string
  readonly passRates: Record<string, { passed: number; total: number }>
}

function aggregateCheckpoints(
  rows: readonly ProfileRow[],
): ReadonlyMap<string, readonly AggregatedCheckpoint[]> {
  const scenarioIds = [...new Set(rows.map((r) => r.scenarioId))]
  const result = new Map<string, readonly AggregatedCheckpoint[]>()

  for (const scenarioId of scenarioIds) {
    const scenarioRows = rows.filter((r) => r.scenarioId === scenarioId)
    const checkpointMap = new Map<string, AggregatedCheckpoint>()

    for (const row of scenarioRows) {
      for (const cp of row.checkpointDetails) {
        const existing = checkpointMap.get(cp.id)
        const passRates = existing ? { ...existing.passRates } : {}
        const modeEntry = passRates[row.mode] ?? { passed: 0, total: 0 }
        passRates[row.mode] = {
          passed: modeEntry.passed + (cp.passed ? 1 : 0),
          total: modeEntry.total + 1,
        }
        checkpointMap.set(cp.id, { id: cp.id, description: cp.description, passRates })
      }
    }

    result.set(scenarioId, [...checkpointMap.values()])
  }

  return result
}

function renderCheckpointDetail(
  rows: readonly ProfileRow[],
  scenarioMetadata?: readonly ScenarioMetadata[],
): readonly string[] {
  const checkpointsByScenario = aggregateCheckpoints(rows)
  const hasCheckpoints = [...checkpointsByScenario.values()].some((cps) => cps.length > 0)

  if (!hasCheckpoints) {
    return ["## Checkpoint Detail", "", "No checkpoint data available.", ""]
  }

  const modes = [...new Set(rows.map((r) => r.mode))]
  const metadataMap = new Map((scenarioMetadata ?? []).map((s) => [s.id, s]))
  const lines: string[] = ["## Checkpoint Detail", ""]

  for (const [scenarioId, checkpoints] of checkpointsByScenario) {
    if (checkpoints.length === 0) continue

    const meta = metadataMap.get(scenarioId)
    lines.push(`### ${meta?.name ?? scenarioId}`, "")

    const header = ["| Checkpoint", "| Condition", ...modes.map((m) => `| ${m}`), "|"].join(" ")
    const sep = ["| ---", "| ---", ...modes.map(() => "| ---"), "|"].join(" ")
    lines.push(header, sep)

    for (const cp of checkpoints) {
      const cells = modes.map((mode) => {
        const entry = cp.passRates[mode]
        if (!entry) return "| -"
        const rate = entry.total === 0 ? 0 : (entry.passed / entry.total) * 100
        return `| ${checkpointRateIndicator(rate)} ${rate.toFixed(0)}%`
      })
      lines.push(`| \`${cp.id}\` | ${cp.description} ${cells.join(" ")} |`)
    }

    lines.push("")
  }

  return lines
}

// ── Section 7: Efficiency Analysis ──────────────────────────────────────────

function renderEfficiencyAnalysis(
  analysisResults: readonly SessionAnalysisBundle[],
): readonly string[] {
  if (analysisResults.length === 0) {
    return ["## Efficiency Analysis", "", "No session analysis data available.", ""]
  }

  const modes = [...new Set(analysisResults.map((b) => b.mode))]
  const lines: string[] = ["## Efficiency Analysis", ""]

  for (const mode of modes) {
    const bundles = analysisResults.filter((b) => b.mode === mode)
    lines.push(`### ${mode}`, "")

    const aggregated = aggregateAnalysis(bundles)
    if (aggregated.length === 0) {
      lines.push("No analysis findings for this mode.", "")
      continue
    }

    lines.push("| Metric | p50 |", "| --- | --- |")
    for (const { label, value } of aggregated) {
      lines.push(`| ${label} | ${value} |`)
    }
    lines.push("")
  }

  return lines
}

interface AggregatedFinding {
  readonly label: string
  readonly value: string
}

function aggregateAnalysis(
  bundles: readonly SessionAnalysisBundle[],
): readonly AggregatedFinding[] {
  const numericFindings = new Map<string, number[]>()
  const stringFindings = new Map<string, string[]>()

  for (const bundle of bundles) {
    for (const [analyzerName, result] of Object.entries(bundle.results)) {
      for (const [key, finding] of Object.entries(result.findings)) {
        const label = `${analyzerName}: ${key}`
        collectFinding(label, finding, numericFindings, stringFindings)
      }
    }
  }

  const results: AggregatedFinding[] = []

  for (const [label, values] of numericFindings) {
    const stats = computeDescriptive(values)
    results.push({ label, value: stats.median.toFixed(2) })
  }

  for (const [label, values] of stringFindings) {
    // For string findings, show the most common value
    const counts = new Map<string, number>()
    for (const v of values) {
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const top = sorted[0]
    if (top) {
      results.push({ label, value: top[0] })
    }
  }

  return results
}

function collectFinding(
  label: string,
  finding: AnalysisFinding,
  numericFindings: Map<string, number[]>,
  stringFindings: Map<string, string[]>,
): void {
  switch (finding.type) {
    case "number": {
      const arr = numericFindings.get(label) ?? []
      arr.push(finding.value)
      numericFindings.set(label, arr)
      break
    }
    case "ratio": {
      const arr = numericFindings.get(label) ?? []
      arr.push(finding.value)
      numericFindings.set(label, arr)
      break
    }
    case "string": {
      const arr = stringFindings.get(label) ?? []
      arr.push(finding.value)
      stringFindings.set(label, arr)
      break
    }
    default:
      break
  }
}

// ── Section 8: Failures & Anomalies ─────────────────────────────────────────

interface AnomalyRow {
  readonly mode: string
  readonly scenarioId: string
  readonly iteration: number
  readonly issue: string
}

function detectAnomalies(rows: readonly ProfileRow[]): readonly AnomalyRow[] {
  const anomalies: AnomalyRow[] = []

  for (const r of rows) {
    const issues: string[] = []

    if (!r.success) issues.push("Failed (checkpoints not passed)")
    if (r.completionReason !== "stop") issues.push(`Completion: ${r.completionReason}`)
    if (r.tokens.total === 0) issues.push("Zero tokens")
    if (r.timing.wallMs === 0) issues.push("Zero wall time")
    if (r.error) issues.push(`Error: ${r.error}`)

    if (issues.length > 0) {
      anomalies.push({
        mode: r.mode,
        scenarioId: r.scenarioId,
        iteration: r.iteration,
        issue: issues.join("; "),
      })
    }
  }

  return anomalies
}

function renderFailuresAndAnomalies(rows: readonly ProfileRow[]): readonly string[] {
  const anomalies = detectAnomalies(rows)

  if (anomalies.length === 0) {
    return ["## Failures & Anomalies", "", "No failures or anomalies detected.", ""]
  }

  const lines: string[] = [
    "## Failures & Anomalies",
    "",
    "| Mode | Scenario | Iteration | Issue |",
    "| --- | --- | --- | --- |",
  ]

  for (const a of anomalies) {
    lines.push(`| ${a.mode} | ${a.scenarioId} | ${a.iteration} | ${a.issue} |`)
  }

  lines.push("")
  return lines
}

// ── Section 9: Data Exports ─────────────────────────────────────────────────

function renderDataExports(): readonly string[] {
  return [
    "## Data Exports",
    "",
    "| File | Description |",
    "| --- | --- |",
    "| [data/results.json](data/results.json) | Full row-level data (JSON) |",
    "| [data/results.csv](data/results.csv) | Full row-level data (CSV) |",
    "| [data/summary.json](data/summary.json) | Aggregated summary with mode/scenario breakdowns |",
    "| [sessions/](sessions/) | Raw session transcripts |",
    "| [analysis/](analysis/) | Per-session analysis bundles |",
    "",
  ]
}

// ── Formatting helpers ──────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  return (ms / 1000).toFixed(1) + "s"
}

function fmtNum(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : n.toFixed(0)
}

function fmtStat(value: number, unit: string): string {
  if (unit === "ms") return `${value.toFixed(0)} ms`
  if (unit === "tokens") return fmtNum(value)
  return value.toFixed(1)
}

// ── Color indicators ────────────────────────────────────────────────────────

const GOOD = "\u{1F7E2}" // green circle
const WARN = "\u{1F7E1}" // yellow circle
const BAD = "\u{1F534}" // red circle

function successIndicator(rate: number): string {
  if (rate >= 90) return GOOD
  if (rate >= 70) return WARN
  return BAD
}

function cvIndicator(cv: number): string {
  if (cv <= 0.2) return GOOD
  if (cv <= 0.4) return WARN
  return BAD
}

function pValueIndicator(p: number): string {
  if (p < 0.05) return GOOD
  if (p < 0.1) return WARN
  return BAD
}

function effectIndicator(magnitude: string): string {
  if (magnitude === "large") return GOOD
  if (magnitude === "medium") return WARN
  return BAD
}

function checkpointRateIndicator(rate: number): string {
  if (rate >= 100) return GOOD
  if (rate >= 50) return WARN
  return BAD
}

function ciIndicator(low: number, high: number): string {
  if ((low > 0 && high > 0) || (low < 0 && high < 0)) return GOOD
  return BAD
}

function failedCallsIndicator(count: number): string {
  if (count === 0) return GOOD
  if (count <= 3) return WARN
  return BAD
}

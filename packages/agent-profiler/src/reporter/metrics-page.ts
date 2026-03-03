import { computeDescriptive } from "@profiler/stats/descriptive.js"
import type { DescriptiveStats } from "@profiler/types/metrics.js"
import type { ProfileRow } from "@profiler/types/profile-row.js"

/** Definition of a single metric to extract from ProfileRow data. */
export interface MetricExtractor {
  readonly label: string
  readonly extract: (row: ProfileRow) => number
}

/** Descriptive statistics for a single metric within a single mode. */
export interface ModeMetricStats {
  readonly mode: string
  readonly label: string
  readonly stats: DescriptiveStats
}

/** The standard set of metrics extracted from ProfileRow data. */
export const METRIC_EXTRACTORS: readonly MetricExtractor[] = [
  { label: "Wall Time (ms)", extract: (r) => r.timing.wallMs },
  { label: "Total Tokens", extract: (r) => r.tokens.total },
  { label: "Total Tool Calls", extract: (r) => r.toolCalls.total },
  { label: "Cost (USD)", extract: (r) => r.cost.totalUsd },
]

/**
 * Compute descriptive statistics for each metric across all modes.
 *
 * Returns an array of per-mode, per-metric stats objects. Useful for
 * building tables and comparisons across modes.
 */
export function computeModeMetrics(
  rows: readonly ProfileRow[],
  extractors: readonly MetricExtractor[] = METRIC_EXTRACTORS,
): readonly ModeMetricStats[] {
  const modes = [...new Set(rows.map((r) => r.mode))]
  const results: ModeMetricStats[] = []

  for (const mode of modes) {
    const modeRows = rows.filter((r) => r.mode === mode)
    for (const metric of extractors) {
      const values = modeRows.map(metric.extract)
      const stats = computeDescriptive(values)
      results.push({ mode, label: metric.label, stats })
    }
  }

  return results
}

function formatStatValue(value: number, isCost: boolean): string {
  return isCost ? value.toFixed(4) : value.toFixed(2)
}

function renderStatsTable(
  label: string,
  stats: DescriptiveStats,
  isCost: boolean,
): readonly string[] {
  const fmt = (v: number) => formatStatValue(v, isCost)
  return [
    `### ${label}`,
    "",
    "| Stat | Value |",
    "| --- | --- |",
    `| Count | ${stats.count} |`,
    `| p50 | ${fmt(stats.median)} |`,
    `| p90 | ${fmt(stats.p90)} |`,
    `| p95 | ${fmt(stats.p95)} |`,
    `| Min | ${fmt(stats.min)} |`,
    `| Max | ${fmt(stats.max)} |`,
    `| IQR | ${fmt(stats.iqr)} |`,
    `| CV | ${stats.cv.toFixed(4)} |`,
    "",
  ]
}

export function generateMetricsPage(rows: readonly ProfileRow[]): string {
  const modeMetrics = computeModeMetrics(rows)
  const modes = [...new Set(modeMetrics.map((m) => m.mode))]

  const sections: string[] = ["# Metrics Detail", ""]

  for (const mode of modes) {
    sections.push(`## Mode: ${mode}`, "")
    const metrics = modeMetrics.filter((m) => m.mode === mode)

    for (const metric of metrics) {
      const isCost = metric.label.includes("Cost")
      const tableLines = renderStatsTable(metric.label, metric.stats, isCost)
      sections.push(...tableLines)
    }
  }

  return sections.join("\n")
}

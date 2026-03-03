import { compareGroups } from "@profiler/stats/comparison.js"
import { computeDescriptive } from "@profiler/stats/descriptive.js"
import type { ComparisonResult, DescriptiveStats } from "@profiler/types/metrics.js"
import type { ProfileRow } from "@profiler/types/profile-row.js"

/** A pairwise comparison result enriched with per-mode descriptive stats. */
export interface PairwiseComparisonResult {
  readonly modeA: string
  readonly modeB: string
  readonly metric: string
  readonly comparison: ComparisonResult
  readonly statsA: DescriptiveStats
  readonly statsB: DescriptiveStats
}

/**
 * Compute pairwise statistical comparisons for a given metric across all mode pairs.
 *
 * Extracts values using the provided extractor, then runs bootstrap CI, Cohen's d,
 * and permutation tests for each ordered pair of modes.
 */
export function computePairwiseComparisons(
  rows: readonly ProfileRow[],
  metric: string,
  extract: (row: ProfileRow) => number,
): readonly PairwiseComparisonResult[] {
  const modes = [...new Set(rows.map((r) => r.mode))]
  if (modes.length < 2) return []

  const results: PairwiseComparisonResult[] = []

  for (let i = 0; i < modes.length; i++) {
    for (let j = i + 1; j < modes.length; j++) {
      const modeA = modes[i] ?? ""
      const modeB = modes[j] ?? ""
      const aValues = rows.filter((r) => r.mode === modeA).map(extract)
      const bValues = rows.filter((r) => r.mode === modeB).map(extract)

      if (aValues.length === 0 || bValues.length === 0) continue

      const comparison = compareGroups(modeA, aValues, modeB, bValues, metric, {
        permutationOptions: { permutations: 1000, seed: 42 },
        bootstrapOptions: { resamples: 1000, seed: 42 },
      })

      results.push({
        modeA,
        modeB,
        metric,
        comparison,
        statsA: computeDescriptive(aValues),
        statsB: computeDescriptive(bValues),
      })
    }
  }

  return results
}

/** Render a simple ASCII bar scaled to 20 chars max. */
function heatBar(reductionPct: number): string {
  const clamped = Math.max(0, Math.min(100, reductionPct))
  const count = Math.round((clamped / 100) * 20)
  return count > 0 ? "#".repeat(count) : "."
}

export function generateComparisonPage(rows: readonly ProfileRow[]): string {
  const comparisons = computePairwiseComparisons(rows, "wallMs", (r) => r.timing.wallMs)

  if (comparisons.length === 0) {
    return ["# Mode Comparison", "", "Single mode — no comparison available."].join("\n")
  }

  const lines: string[] = [
    "# Mode Comparison",
    "",
    "Pairwise statistical comparison of **wall-clock latency (ms)** across modes.",
    "A positive reduction means mode A completed faster than mode B across all iterations.",
    "",
  ]

  for (const { modeA, modeB, comparison: result, statsA, statsB } of comparisons) {
    const ci0 = result.ci95[0] ?? 0
    const ci1 = result.ci95[1] ?? 0

    lines.push(
      `## ${modeA} vs ${modeB}`,
      "",
      "| Metric | Value |",
      "| --- | --- |",
      `| Median wall-time (${modeA}) | ${statsA.median.toFixed(0)} ms |`,
      `| Median wall-time (${modeB}) | ${statsB.median.toFixed(0)} ms |`,
      `| Wall-time reduction | ${result.reductionPct.toFixed(1)}% |`,
      `| 95% CI | [${ci0.toFixed(1)}%, ${ci1.toFixed(1)}%] |`,
      `| Effect size (Cohen's d) | ${result.effectSize.toFixed(3)} (${result.effectMagnitude}) |`,
      `| p-value | ${result.pValue.toFixed(4)} |`,
      "",
      "```",
      `${heatBar(result.reductionPct)} ${result.reductionPct.toFixed(1)}% wall-time reduction`,
      "```",
      "",
    )
  }

  return lines.join("\n")
}

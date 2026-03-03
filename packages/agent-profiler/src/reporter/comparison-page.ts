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

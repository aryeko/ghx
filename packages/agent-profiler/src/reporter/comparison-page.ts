import { compareGroups } from "@profiler/stats/comparison.js"
import { computeDescriptive } from "@profiler/stats/descriptive.js"
import type { ProfileRow } from "@profiler/types/profile-row.js"

/** Render a simple ASCII bar scaled to 20 chars max. */
function heatBar(reductionPct: number): string {
  const clamped = Math.max(0, Math.min(100, reductionPct))
  const count = Math.round((clamped / 100) * 20)
  return count > 0 ? "#".repeat(count) : "."
}

export function generateComparisonPage(rows: readonly ProfileRow[]): string {
  const modes = [...new Set(rows.map((r) => r.mode))]

  if (modes.length < 2) {
    return ["# Mode Comparison", "", "Single mode — no comparison available."].join("\n")
  }

  const lines: string[] = [
    "# Mode Comparison",
    "",
    "Pairwise statistical comparison of **wall-clock latency (ms)** across modes.",
    "A positive reduction means mode A completed faster than mode B on the same scenarios.",
    "",
  ]

  for (let i = 0; i < modes.length; i++) {
    for (let j = i + 1; j < modes.length; j++) {
      const modeA = modes[i] ?? ""
      const modeB = modes[j] ?? ""
      const aValues = rows.filter((r) => r.mode === modeA).map((r) => r.timing.wallMs)
      const bValues = rows.filter((r) => r.mode === modeB).map((r) => r.timing.wallMs)

      if (aValues.length === 0 || bValues.length === 0) continue

      const result = compareGroups(modeA, aValues, modeB, bValues, "wallMs", {
        permutationOptions: { permutations: 1000, seed: 42 },
        bootstrapOptions: { resamples: 1000, seed: 42 },
      })

      const statsA = computeDescriptive(aValues)
      const statsB = computeDescriptive(bValues)
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
  }

  return lines.join("\n")
}

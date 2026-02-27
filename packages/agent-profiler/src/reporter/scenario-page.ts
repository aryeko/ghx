import type { ProfileRow } from "@profiler/types/profile-row.js"

export function generateScenarioPage(rows: readonly ProfileRow[], scenarioId: string): string {
  const lines: string[] = [
    `# Scenario: ${scenarioId}`,
    "",
    "## Per-Iteration Results",
    "",
    "| Iteration | Mode | Success | Wall (ms) | Tokens | Tool Calls | Cost (USD) |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ]

  const sorted = [...rows].sort((a, b) => {
    const iterDiff = a.iteration - b.iteration
    if (iterDiff !== 0) return iterDiff
    return a.mode.localeCompare(b.mode)
  })

  for (const row of sorted) {
    lines.push(
      `| ${row.iteration} | ${row.mode} | ${row.success ? "yes" : "no"} | ${row.timing.wallMs} | ${row.tokens.total} | ${row.toolCalls.total} | ${row.cost.totalUsd.toFixed(4)} |`,
    )
  }

  return lines.join("\n")
}

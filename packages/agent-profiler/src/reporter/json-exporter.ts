import { computeDescriptive } from "@profiler/stats/descriptive.js"
import type { ProfileRow } from "@profiler/types/profile-row.js"

export function exportResultsJson(rows: readonly ProfileRow[]): string {
  return JSON.stringify(rows, null, 2)
}

interface ModeBreakdown {
  readonly successRate: number
  readonly count: number
  readonly medians: {
    readonly wallMs: number
    readonly activeTokens: number
    readonly toolCalls: number
    readonly costUsd: number
  }
}

interface ScenarioBreakdown {
  readonly count: number
  readonly successRate: number
}

export function exportSummaryJson(rows: readonly ProfileRow[], runId: string): string {
  const modes = [...new Set(rows.map((r) => r.mode))]
  const scenarios = [...new Set(rows.map((r) => r.scenarioId))]
  const successCount = rows.filter((r) => r.success).length
  const successRate = rows.length === 0 ? 0 : successCount / rows.length

  const modeBreakdowns: Record<string, ModeBreakdown> = {}
  for (const mode of modes) {
    const modeRows = rows.filter((r) => r.mode === mode)
    const modeSuccess = modeRows.filter((r) => r.success).length
    const wallStats = computeDescriptive(modeRows.map((r) => r.timing.wallMs))
    const activeStats = computeDescriptive(modeRows.map((r) => r.tokens.active))
    const toolStats = computeDescriptive(modeRows.map((r) => r.toolCalls.total))
    const costStats = computeDescriptive(modeRows.map((r) => r.cost.totalUsd))

    modeBreakdowns[mode] = {
      successRate: modeRows.length === 0 ? 0 : modeSuccess / modeRows.length,
      count: modeRows.length,
      medians: {
        wallMs: wallStats.median,
        activeTokens: activeStats.median,
        toolCalls: toolStats.median,
        costUsd: costStats.median,
      },
    }
  }

  const scenarioBreakdowns: Record<string, ScenarioBreakdown> = {}
  for (const scenario of scenarios) {
    const scenarioRows = rows.filter((r) => r.scenarioId === scenario)
    const scenarioSuccess = scenarioRows.filter((r) => r.success).length
    scenarioBreakdowns[scenario] = {
      count: scenarioRows.length,
      successRate: scenarioRows.length === 0 ? 0 : scenarioSuccess / scenarioRows.length,
    }
  }

  const summary = {
    version: 2,
    runId,
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    modes,
    scenarios,
    successRate,
    modeBreakdowns,
    scenarioBreakdowns,
  }

  return JSON.stringify(summary, null, 2)
}

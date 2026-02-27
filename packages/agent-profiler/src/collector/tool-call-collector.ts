import type { Collector } from "../contracts/collector.js"
import type { PromptResult } from "../contracts/provider.js"
import type { CustomMetric } from "../types/metrics.js"
import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace } from "../types/trace.js"

export class ToolCallCollector implements Collector {
  readonly id = "tool_calls"

  async collect(
    result: PromptResult,
    _scenario: BaseScenario,
    _mode: string,
    _trace: SessionTrace | null,
  ): Promise<readonly CustomMetric[]> {
    const { toolCalls } = result.metrics

    const total = toolCalls.length
    const failed = toolCalls.filter((tc) => !tc.success).length
    const errorRate = total === 0 ? 0 : failed / total

    const uniqueNames = new Set(toolCalls.map((tc) => tc.name))

    const categoryCounts = new Map<string, number>()
    for (const tc of toolCalls) {
      const prev = categoryCounts.get(tc.category) ?? 0
      categoryCounts.set(tc.category, prev + 1)
    }

    const metrics: CustomMetric[] = [
      { name: "tool_calls_total", value: total, unit: "count" },
      { name: "tool_calls_failed", value: failed, unit: "count" },
      { name: "tool_calls_error_rate", value: errorRate, unit: "ratio" },
      { name: "tool_calls_unique", value: uniqueNames.size, unit: "count" },
    ]

    const sortedCategories = [...categoryCounts.entries()].sort(([a], [b]) => a.localeCompare(b))
    for (const [category, count] of sortedCategories) {
      metrics.push({
        name: `tool_calls_category_${category}`,
        value: count,
        unit: "count",
      })
    }

    return metrics
  }
}

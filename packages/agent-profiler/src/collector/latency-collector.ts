import type { Collector } from "../contracts/collector.js"
import type { PromptResult } from "../contracts/provider.js"
import type { CustomMetric } from "../types/metrics.js"
import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace } from "../types/trace.js"

export class LatencyCollector implements Collector {
  readonly id = "latency"

  async collect(
    result: PromptResult,
    _scenario: BaseScenario,
    _mode: string,
    _trace: SessionTrace | null,
  ): Promise<readonly CustomMetric[]> {
    const { timing } = result.metrics
    const metrics: CustomMetric[] = [{ name: "latency_wall_ms", value: timing.wallMs, unit: "ms" }]

    for (const segment of timing.segments) {
      const durationMs = segment.endMs - segment.startMs
      metrics.push({
        name: `latency_${segment.label}_ms`,
        value: durationMs,
        unit: "ms",
      })
    }

    return metrics
  }
}

import type { Collector } from "../contracts/collector.js"
import type { PromptResult } from "../contracts/provider.js"
import type { CustomMetric } from "../types/metrics.js"
import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace } from "../types/trace.js"

export class CostCollector implements Collector {
  readonly id = "cost"

  async collect(
    result: PromptResult,
    _scenario: BaseScenario,
    _mode: string,
    _trace: SessionTrace | null,
  ): Promise<readonly CustomMetric[]> {
    const { cost } = result.metrics
    return [
      { name: "cost_total_usd", value: cost.totalUsd, unit: "usd" },
      { name: "cost_input_usd", value: cost.inputUsd, unit: "usd" },
      { name: "cost_output_usd", value: cost.outputUsd, unit: "usd" },
      { name: "cost_reasoning_usd", value: cost.reasoningUsd, unit: "usd" },
    ]
  }
}

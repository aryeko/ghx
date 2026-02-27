import type { Collector } from "../contracts/collector.js"
import type { PromptResult } from "../contracts/provider.js"
import type { CustomMetric } from "../types/metrics.js"
import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace } from "../types/trace.js"

export class TokenCollector implements Collector {
  readonly id = "token"

  async collect(
    result: PromptResult,
    _scenario: BaseScenario,
    _mode: string,
    _trace: SessionTrace | null,
  ): Promise<readonly CustomMetric[]> {
    const { tokens } = result.metrics
    return [
      { name: "tokens_input", value: tokens.input, unit: "tokens" },
      { name: "tokens_output", value: tokens.output, unit: "tokens" },
      { name: "tokens_reasoning", value: tokens.reasoning, unit: "tokens" },
      { name: "tokens_cache_read", value: tokens.cacheRead, unit: "tokens" },
      { name: "tokens_cache_write", value: tokens.cacheWrite, unit: "tokens" },
      { name: "tokens_total", value: tokens.total, unit: "tokens" },
      { name: "tokens_active", value: tokens.active, unit: "tokens" },
    ]
  }
}

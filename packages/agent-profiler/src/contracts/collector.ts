import type { CustomMetric } from "../types/metrics.js"
import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace } from "../types/trace.js"
import type { PromptResult } from "./provider.js"

export interface Collector {
  readonly id: string
  collect(
    result: PromptResult,
    scenario: BaseScenario,
    mode: string,
    trace: SessionTrace | null,
  ): Promise<readonly CustomMetric[]>
}

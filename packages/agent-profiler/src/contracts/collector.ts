import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace } from "../types/trace.js"
import type { PromptResult } from "./provider.js"

export interface CustomMetric {
  readonly name: string
  readonly value: number | string
  readonly unit: string
}

export interface Collector {
  readonly id: string
  collect(
    result: PromptResult,
    scenario: BaseScenario,
    mode: string,
    trace: SessionTrace | null,
  ): Promise<readonly CustomMetric[]>
}

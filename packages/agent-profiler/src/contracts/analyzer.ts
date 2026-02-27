import type { BaseScenario } from "../types/scenario.js"
import type { AnalysisResult, SessionTrace } from "../types/trace.js"

export interface Analyzer {
  readonly name: string
  analyze(trace: SessionTrace, scenario: BaseScenario, mode: string): Promise<AnalysisResult>
}

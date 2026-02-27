import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace } from "../types/trace.js"

export type AnalysisFinding =
  | { readonly type: "number"; readonly value: number; readonly unit: string }
  | { readonly type: "string"; readonly value: string }
  | { readonly type: "list"; readonly values: readonly string[] }
  | {
      readonly type: "table"
      readonly headers: readonly string[]
      readonly rows: readonly (readonly string[])[]
    }
  | { readonly type: "ratio"; readonly value: number; readonly label: string }

export interface AnalysisResult {
  readonly analyzer: string
  readonly findings: Readonly<Record<string, AnalysisFinding>>
  readonly summary: string
}

export interface Analyzer {
  readonly name: string
  analyze(trace: SessionTrace, scenario: BaseScenario, mode: string): Promise<AnalysisResult>
}

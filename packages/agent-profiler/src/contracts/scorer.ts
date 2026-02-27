import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace } from "../types/trace.js"

export interface ScorerContext {
  readonly agentOutput: string
  readonly trace: SessionTrace | null
  readonly mode: string
  readonly model: string
  readonly iteration: number
  readonly metadata: Readonly<Record<string, unknown>>
}

export interface ScorerCheckResult {
  readonly id: string
  readonly description: string
  readonly passed: boolean
  readonly actual?: unknown
  readonly expected?: unknown
  readonly error?: string
}

export interface ScorerResult {
  readonly success: boolean
  readonly passed: number
  readonly total: number
  readonly details: readonly ScorerCheckResult[]
  readonly outputValid: boolean
  readonly error?: string
}

export interface Scorer {
  readonly id: string
  evaluate(scenario: BaseScenario, context: ScorerContext): Promise<ScorerResult>
}

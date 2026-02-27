import type {
  CheckpointResult,
  CostBreakdown,
  TimingBreakdown,
  TokenBreakdown,
  ToolCallRecord,
} from "./metrics.js"

export interface ProfileRow {
  readonly runId: string
  readonly scenarioId: string
  readonly mode: string
  readonly model: string
  readonly iteration: number
  readonly startedAt: string
  readonly completedAt: string
  readonly tokens: TokenBreakdown
  readonly timing: TimingBreakdown
  readonly toolCalls: {
    readonly total: number
    readonly byCategory: Readonly<Record<string, number>>
    readonly failed: number
    readonly retried: number
    readonly errorRate: number
    readonly records: readonly ToolCallRecord[]
  }
  readonly cost: CostBreakdown
  readonly success: boolean
  readonly checkpointsPassed: number
  readonly checkpointsTotal: number
  readonly checkpointDetails: readonly CheckpointResult[]
  readonly outputValid: boolean
  readonly provider: string
  readonly sessionId: string
  readonly agentTurns: number
  readonly completionReason: "stop" | "timeout" | "error" | "tool_limit"
  readonly extensions: Readonly<Record<string, unknown>>
  readonly error?: string
  readonly errorCode?: string
}

import type { TokenBreakdown } from "./metrics.js"

export type TraceEvent =
  | {
      readonly type: "reasoning"
      readonly content: string
      readonly durationMs: number
      readonly tokenCount: number
    }
  | {
      readonly type: "tool_call"
      readonly name: string
      readonly input: unknown
      readonly output: unknown
      readonly durationMs: number
      readonly success: boolean
      readonly error?: string
    }
  | {
      readonly type: "text_output"
      readonly content: string
      readonly tokenCount: number
    }
  | {
      readonly type: "turn_boundary"
      readonly turnNumber: number
      readonly timestamp: string
    }
  | {
      readonly type: "error"
      readonly message: string
      readonly recoverable: boolean
    }

export interface Turn {
  readonly number: number
  readonly events: readonly TraceEvent[]
  readonly startTimestamp: string
  readonly endTimestamp: string
  readonly durationMs: number
}

export interface SessionTrace {
  readonly sessionId: string
  readonly events: readonly TraceEvent[]
  readonly turns: readonly Turn[]
  readonly summary: {
    readonly totalTurns: number
    readonly totalToolCalls: number
    readonly totalTokens: TokenBreakdown
    readonly totalDuration: number
  }
}

export interface TraceNormalizer {
  normalize(rawTrace: SessionTrace): readonly TraceEvent[]
}

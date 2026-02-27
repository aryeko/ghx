export interface TokenBreakdown {
  readonly input: number
  readonly output: number
  readonly reasoning: number
  readonly cacheRead: number
  readonly cacheWrite: number
  readonly total: number
  readonly active: number
}

export interface TimingSegment {
  readonly label: string
  readonly startMs: number
  readonly endMs: number
}

export interface TimingBreakdown {
  readonly wallMs: number
  readonly segments: readonly TimingSegment[]
}

export interface CostBreakdown {
  readonly totalUsd: number
  readonly inputUsd: number
  readonly outputUsd: number
  readonly reasoningUsd: number
}

export interface ToolCallRecord {
  readonly name: string
  readonly category: string
  readonly success: boolean
  readonly durationMs: number | null
  readonly error?: string
}

export interface CheckpointResult {
  readonly id: string
  readonly description: string
  readonly passed: boolean
  readonly actual?: unknown
  readonly expected?: unknown
}

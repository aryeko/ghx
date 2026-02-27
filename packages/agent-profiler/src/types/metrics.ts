export interface TokenBreakdown {
  readonly input: number
  readonly output: number
  readonly reasoning: number
  readonly cacheRead: number
  readonly cacheWrite: number
  readonly total: number
  readonly active: number
}

export interface TimingBreakdown {
  readonly wallMs: number
  readonly segments: readonly TimingSegment[]
}

export interface TimingSegment {
  readonly label: string
  readonly startMs: number
  readonly endMs: number
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

export interface DescriptiveStats {
  readonly count: number
  readonly mean: number
  readonly median: number
  readonly p90: number
  readonly p95: number
  readonly min: number
  readonly max: number
  readonly iqr: number
  readonly cv: number
  readonly stddev: number
}

export interface ComparisonResult {
  readonly modeA: string
  readonly modeB: string
  readonly metric: string
  readonly reductionPct: number
  readonly ci95: readonly [number, number]
  readonly effectSize: number
  readonly effectMagnitude: "negligible" | "small" | "medium" | "large"
  readonly pValue: number
}

export interface ConfidenceInterval {
  readonly lower: number
  readonly upper: number
  readonly confidenceLevel: number
  readonly resamples: number
  readonly pointEstimate: number
}

export interface EffectSize {
  readonly d: number
  readonly magnitude: "negligible" | "small" | "medium" | "large"
}

export interface PermutationResult {
  readonly pValue: number
  readonly observedDifference: number
  readonly permutations: number
}

export interface CustomMetric {
  readonly name: string
  readonly value: number | string
  readonly unit: string
}

# Metric Types

Reference for all metric-related TypeScript interfaces used throughout the profiler, from per-iteration breakdowns to cross-mode statistical comparisons.

**Source:** `packages/agent-profiler/src/types/metrics.ts`

## Import

```typescript
import type {
  TokenBreakdown,
  TimingBreakdown,
  TimingSegment,
  CostBreakdown,
  ToolCallRecord,
  DescriptiveStats,
  ComparisonResult,
  ConfidenceInterval,
  EffectSize,
  PermutationResult,
  CustomMetric,
} from "@ghx-dev/agent-profiler"
```

## Iteration-Level Types

These interfaces describe metrics collected during a single profiling iteration and appear as fields on [`ProfileRow`](./profile-row.md).

### TokenBreakdown

Breakdown of token usage for a single agent session.

| Field | Type | Description |
|-------|------|-------------|
| `input` | `number` | Input/prompt tokens |
| `output` | `number` | Model output tokens |
| `reasoning` | `number` | Extended reasoning tokens |
| `cacheRead` | `number` | Tokens served from cache |
| `cacheWrite` | `number` | Tokens written to cache |
| `total` | `number` | Sum of all categories |
| `active` | `number` | Non-cached tokens (input + output + reasoning) |

### TimingBreakdown

Wall-clock timing and optional sub-segments for a single iteration.

| Field | Type | Description |
|-------|------|-------------|
| `wallMs` | `number` | Total elapsed wall-clock time (ms) |
| `segments` | `TimingSegment[]` | Named sub-segments |

### TimingSegment

A named time interval within an iteration.

| Field | Type | Description |
|-------|------|-------------|
| `label` | `string` | Segment label |
| `startMs` | `number` | Start (ms since epoch) |
| `endMs` | `number` | End (ms since epoch) |

### CostBreakdown

Cost breakdown in USD for a single iteration.

| Field | Type | Description |
|-------|------|-------------|
| `totalUsd` | `number` | Total cost in USD |
| `inputUsd` | `number` | Input token cost |
| `outputUsd` | `number` | Output token cost |
| `reasoningUsd` | `number` | Reasoning token cost |

### ToolCallRecord

Record of a single tool invocation during an agent session.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Tool name |
| `category` | `string` | Logical category |
| `success` | `boolean` | Completed successfully |
| `durationMs` | `number \| null` | Elapsed time (ms) |
| `error?` | `string` | Error message if failed |

### CustomMetric

An arbitrary metric attached by a collector via the `extensions` mechanism.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Metric name |
| `value` | `number \| string` | Measured value |
| `unit` | `string` | Unit of measurement |

## Statistical Types

These interfaces represent the output of statistical analysis functions applied across multiple iterations or modes.

### DescriptiveStats

Summary statistics computed from a sample of numeric values.

| Field | Type | Description |
|-------|------|-------------|
| `count` | `number` | Sample count |
| `mean` | `number` | Arithmetic mean |
| `median` | `number` | 50th percentile |
| `p90` | `number` | 90th percentile |
| `p95` | `number` | 95th percentile |
| `min` | `number` | Minimum |
| `max` | `number` | Maximum |
| `iqr` | `number` | Interquartile range (p75 - p25) |
| `cv` | `number` | Coefficient of variation |
| `stddev` | `number` | Sample standard deviation |

### ComparisonResult

Result of comparing a candidate mode against a baseline mode on a single metric.

| Field | Type | Description |
|-------|------|-------------|
| `modeA` | `string` | Candidate mode |
| `modeB` | `string` | Baseline mode |
| `metric` | `string` | Metric name |
| `reductionPct` | `number` | Median reduction % |
| `ci95` | `[number, number]` | 95% bootstrap CI |
| `effectSize` | `number` | Cohen's d |
| `effectMagnitude` | `"negligible" \| "small" \| "medium" \| "large"` | Qualitative magnitude |
| `pValue` | `number` | Permutation test p-value |

### ConfidenceInterval

Bootstrap confidence interval for a point estimate.

| Field | Type | Description |
|-------|------|-------------|
| `lower` | `number` | Lower bound |
| `upper` | `number` | Upper bound |
| `confidenceLevel` | `number` | Confidence level (e.g. 0.95) |
| `resamples` | `number` | Bootstrap resamples used |
| `pointEstimate` | `number` | Point estimate of statistic |

### EffectSize

Cohen's d effect size with a qualitative magnitude label.

| Field | Type | Description |
|-------|------|-------------|
| `d` | `number` | Cohen's d (signed) |
| `magnitude` | `"negligible" \| "small" \| "medium" \| "large"` | Qualitative magnitude |

### PermutationResult

Result of a permutation test for difference in means between two groups.

| Field | Type | Description |
|-------|------|-------------|
| `pValue` | `number` | Two-sided p-value |
| `observedDifference` | `number` | Observed mean difference |
| `permutations` | `number` | Permutations used |

## Related Documentation

- [ProfileRow Type Reference](./profile-row.md) -- where iteration-level metric types appear
- [Public API](./public-api.md) -- functions that produce these types (e.g. `computeDescriptive`, `bootstrapCI`, `cohensD`)
- [Quick Start](../getting-started/quick-start.md) -- run your first profiling suite

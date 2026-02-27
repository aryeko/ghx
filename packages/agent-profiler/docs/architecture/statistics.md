# Statistics Engine

Understand the statistical methods used for analyzing and comparing profiling results.

The statistics engine provides four categories of analysis: descriptive statistics for summarizing distributions, bootstrap confidence intervals for uncertainty quantification, effect size measures for practical significance, and permutation tests for statistical significance.

## Descriptive Statistics

Computes standard summary statistics for a numeric array.

Source: `packages/agent-profiler/src/stats/descriptive.ts`

```typescript
import { computeDescriptive } from "@ghx-dev/agent-profiler"

const stats = computeDescriptive(values)
```

**Function signature:**

```typescript
function computeDescriptive(values: number[]): DescriptiveStats
```

**DescriptiveStats fields:**

| Field | Description |
|-------|-------------|
| `count` | Number of values |
| `mean` | Arithmetic mean |
| `median` | 50th percentile |
| `p90` | 90th percentile |
| `p95` | 95th percentile |
| `min` | Minimum value |
| `max` | Maximum value |
| `iqr` | Interquartile range (p75 - p25) |
| `cv` | Coefficient of variation (stddev / mean) |
| `stddev` | Sample standard deviation |

**Implementation notes:**

- Uses linear interpolation for percentile calculations (not nearest-rank).
- Returns all zeros for empty input arrays.
- Uses sample standard deviation with `n - 1` denominator (Bessel's correction).

## Bootstrap Confidence Intervals

Estimates confidence intervals using the percentile bootstrap method with a seeded deterministic PRNG.

Source: `packages/agent-profiler/src/stats/bootstrap.ts`

### bootstrapCI

Computes a confidence interval for a single group.

```typescript
import { bootstrapCI } from "@ghx-dev/agent-profiler"

const ci = bootstrapCI(values, { resamples: 10_000, confidenceLevel: 0.95 })
```

**Function signature:**

```typescript
function bootstrapCI(
  values: number[],
  options?: BootstrapCIOptions
): ConfidenceInterval
```

**BootstrapCIOptions defaults:**

| Option | Default | Description |
|--------|---------|-------------|
| `resamples` | 10,000 | Number of bootstrap resamples |
| `confidenceLevel` | 0.95 | Confidence level |
| `statistic` | `median (function)` | Statistic function applied to each resample |
| `seed` | 42 | PRNG seed for deterministic results |

**Implementation notes:**

- Uses the Mulberry32 algorithm as the seeded PRNG for reproducibility.
- Returns a degenerate interval (lower = upper = value) for arrays with 0 or 1 elements.
- The percentile method sorts the bootstrapped statistics and reads off quantiles directly.

### bootstrapReductionCI

Computes a confidence interval for the percentage reduction between two groups.

```typescript
import { bootstrapReductionCI } from "@ghx-dev/agent-profiler"

const ci = bootstrapReductionCI(modeAValues, modeBValues, {
  resamples: 10_000,
  confidenceLevel: 0.95,
})
```

**Function signature:**

```typescript
function bootstrapReductionCI(
  modeA: number[],
  modeB: number[],
  options?: BootstrapCIOptions
): ConfidenceInterval
```

**Point estimate calculation:**

```text
reduction = (1 - median(A) / median(B)) * 100
```

A positive reduction means mode A has lower values than mode B (a reduction). A negative reduction means mode A has higher values. Uses the same defaults as `bootstrapCI`.

## Effect Size

Quantifies the practical significance of the difference between two groups using Cohen's d.

Source: `packages/agent-profiler/src/stats/comparison.ts`

```typescript
import { cohensD } from "@ghx-dev/agent-profiler"

const effect = cohensD(groupA, groupB)
```

**Function signature:**

```typescript
function cohensD(groupA: number[], groupB: number[]): EffectSize
```

**EffectSize fields:**

```typescript
interface EffectSize {
  readonly d: number
  readonly magnitude: "negligible" | "small" | "medium" | "large"
}
```

**Magnitude thresholds:**

| Magnitude | Absolute d |
|-----------|------------|
| negligible | < 0.2 |
| small | 0.2 -- 0.5 |
| medium | 0.5 -- 0.8 |
| large | >= 0.8 |

**Implementation notes:**

- Uses pooled standard deviation: `sqrt(((nA-1)*sdA^2 + (nB-1)*sdB^2) / (nA+nB-2))`.
- Returns `d = 0` with magnitude `"negligible"` when both groups have zero variance.

## Permutation Tests

Tests the null hypothesis that two groups come from the same distribution using a randomization test.

Source: `packages/agent-profiler/src/stats/comparison.ts`

```typescript
import { permutationTest } from "@ghx-dev/agent-profiler"

const result = permutationTest(groupA, groupB, {
  permutations: 10_000,
  alternative: "two-sided",
})
```

**Function signature:**

```typescript
function permutationTest(
  groupA: number[],
  groupB: number[],
  options?: PermutationTestOptions
): PermutationResult
```

**PermutationTestOptions defaults:**

| Option | Default | Description |
|--------|---------|-------------|
| `permutations` | 10,000 | Number of random permutations |
| `alternative` | `"two-sided"` | Test direction |
| `seed` | 42 | PRNG seed for deterministic results |

**Supported alternatives:**

| Alternative | Null Hypothesis Rejection |
|-------------|---------------------------|
| `"two-sided"` | Groups differ in either direction |
| `"less"` | Group A is less than Group B |
| `"greater"` | Group A is greater than Group B |

**Implementation notes:**

- Uses the Fisher-Yates shuffle algorithm with the seeded Mulberry32 PRNG.
- The test statistic is the difference of means: `mean(A) - mean(B)`.
- The p-value is the proportion of permuted test statistics at least as extreme as the observed statistic.

## Full Comparison

Combines bootstrap reduction CI, Cohen's d effect size, and permutation test into a single comparison result.

Source: `packages/agent-profiler/src/stats/comparison.ts`

```typescript
import { compareGroups } from "@ghx-dev/agent-profiler"

const result = compareGroups(
  "agent_direct",
  agentDirectValues,
  "ghx",
  ghxValues,
  "latency_wall_ms"
)
```

**Function signature:**

```typescript
function compareGroups(
  modeA: string,
  modeAValues: number[],
  modeB: string,
  modeBValues: number[],
  metric: string,
  options?: CompareGroupsOptions
): ComparisonResult
```

**ComparisonResult fields:**

| Field | Type | Description |
|-------|------|-------------|
| `modeA` | string | Name of the first group |
| `modeB` | string | Name of the second group |
| `metric` | string | Metric being compared |
| `reductionPct` | number | Percentage reduction (positive = A is lower) |
| `ci95` | `readonly [number, number]` | 95% bootstrap CI lower and upper bounds |
| `effectSize` | number | Cohen's d value |
| `effectMagnitude` | string | `"negligible"`, `"small"`, `"medium"`, or `"large"` |
| `pValue` | number | Permutation test p-value |

## Default Constants

Source: `packages/agent-profiler/src/shared/constants.ts`

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_BOOTSTRAP_RESAMPLES` | 10,000 | Bootstrap resamples per CI |
| `DEFAULT_PERMUTATION_COUNT` | 10,000 | Permutations per significance test |
| `DEFAULT_CONFIDENCE_LEVEL` | 0.95 | Confidence level for CIs |
| `DEFAULT_REPETITIONS` | 5 | Repetitions per scenario per mode |
| `DEFAULT_TIMEOUT_MS` | 120,000 | Prompt timeout in milliseconds |
| `DEFAULT_WARMUP` | true | Run warmup canary before suite |
| `DEFAULT_SESSION_EXPORT` | true | Export session traces |
| `DEFAULT_LOG_LEVEL` | `"info"` | Logging verbosity |
| `DEFAULT_RESULTS_DIR` | `"results"` | Directory for JSONL output |
| `DEFAULT_REPORTS_DIR` | `"reports"` | Directory for generated reports |
| `DEFAULT_ALLOWED_RETRIES` | 0 | Retry attempts per iteration |

## Related Documentation

- [System Overview](./overview.md)
- [Built-in Collectors](./built-in-collectors.md)
- [Guides: Reports](../guides/reports.md)
- [API: Metric Types](../api/metric-types.md)

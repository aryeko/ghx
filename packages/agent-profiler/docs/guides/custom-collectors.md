# Custom Collectors

Create custom Collector implementations to extract domain-specific metrics from prompt results and session traces.

## Collector Contract

A collector runs after every prompt call and produces an array of `CustomMetric` values. These metrics are stored in the `ProfileRow.extensions` field as key-value pairs, making them available for statistical analysis and reporting.

```typescript
interface Collector {
  readonly id: string
  collect(
    result: PromptResult,
    scenario: BaseScenario,
    mode: string,
    trace: SessionTrace | null,
  ): Promise<readonly CustomMetric[]>
}
```

Each `CustomMetric` has three fields:

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Metric key used in ProfileRow.extensions and report columns |
| `value` | `number \| string` | The metric value |
| `unit` | `string` | Unit label for display (e.g., `"count"`, `"ms"`, `"bytes"`, `"ratio"`) |

## Basic Example

A collector that counts the number of reasoning events from the session trace:

```typescript
import type { Collector, CustomMetric, PromptResult, BaseScenario, SessionTrace } from "@ghx-dev/agent-profiler"

const reasoningCountCollector: Collector = {
  id: "reasoning_count",
  async collect(
    _result: PromptResult,
    _scenario: BaseScenario,
    _mode: string,
    trace: SessionTrace | null,
  ): Promise<readonly CustomMetric[]> {
    if (!trace) return []
    const count = trace.events.filter((e) => e.type === "reasoning").length
    return [{ name: "reasoning_events", value: count, unit: "count" }]
  },
}
```

## Multi-Metric Collector

A single collector can return multiple metrics. This example extracts several tool-call statistics:

```typescript
import type { Collector, CustomMetric, PromptResult, BaseScenario, SessionTrace } from "@ghx-dev/agent-profiler"

const toolStatsCollector: Collector = {
  id: "tool_stats",
  async collect(
    result: PromptResult,
    _scenario: BaseScenario,
    _mode: string,
    _trace: SessionTrace | null,
  ): Promise<readonly CustomMetric[]> {
    const toolCalls = result.metrics.toolCalls
    const total = toolCalls.length
    const failed = toolCalls.filter((t) => !t.success).length
    const durations = toolCalls
      .map((t) => t.durationMs)
      .filter((d): d is number => d !== null)
    const avgDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0

    return [
      { name: "tool_call_total", value: total, unit: "count" },
      { name: "tool_call_failures", value: failed, unit: "count" },
      { name: "tool_call_avg_duration", value: Math.round(avgDuration), unit: "ms" },
    ]
  },
}
```

## Metric Storage

Metrics returned by collectors are stored in the `ProfileRow.extensions` field as a flat key-value map. The metric `name` becomes the key and `value` becomes the value:

```typescript
// If a collector returns:
[
  { name: "reasoning_events", value: 12, unit: "count" },
  { name: "tool_call_total", value: 5, unit: "count" },
]

// The ProfileRow.extensions will contain:
{
  reasoning_events: 12,
  tool_call_total: 5,
}
```

The statistics engine computes descriptive statistics (mean, median, p90, p95, stddev, CV, IQR) for all numeric extension values across repetitions. String-valued metrics are preserved but excluded from statistical aggregation.

## Registering Collectors

Pass collectors to `runProfileSuite` via the `collectors` array in `ProfileSuiteOptions`:

```typescript
import { runProfileSuite, TokenCollector, LatencyCollector, CostCollector, ToolCallCollector } from "@ghx-dev/agent-profiler"

const result = await runProfileSuite({
  // ... other options
  collectors: [
    new TokenCollector(),
    new LatencyCollector(),
    new CostCollector(),
    new ToolCallCollector(),
    reasoningCountCollector,   // your custom collector
    toolStatsCollector,        // another custom collector
  ],
})
```

Collectors execute in array order. Each collector receives the same `PromptResult`, `BaseScenario`, mode string, and `SessionTrace` (or null). The runner aggregates all returned `CustomMetric[]` arrays into a single extensions map.

## Pitfalls

- **Trace may be null.** If `sessionExport` is disabled and no analyzers are registered, the runner does not call `exportSession`. Return an empty array when your collector requires trace data and none is available.
- **Metric names must be unique across collectors.** If two collectors return metrics with the same `name`, the later value overwrites the earlier one. Use a namespace prefix (e.g., `"myplugin_metric_name"`) to avoid collisions.
- **Collectors run on every iteration.** Keep implementations fast. Avoid expensive I/O or network calls in the `collect` method.

## Source Reference

- Collector contract: `packages/agent-profiler/src/contracts/collector.ts`
- Built-in collectors: `packages/agent-profiler/src/collector/`
- Runner collector invocation: `packages/agent-profiler/src/runner/iteration.ts`

## Related Documentation

- [Custom Analyzers](custom-analyzers.md) -- produce structured findings from traces
- [Implementing a Provider](implementing-a-provider.md) -- the PromptResult source
- [Reports](reports.md) -- how custom metrics appear in reports
- [Plugin Contracts](../architecture/plugin-contracts.md) -- full interface definitions
- [Core Concepts](../getting-started/concepts.md) -- mental model and plugin-first architecture

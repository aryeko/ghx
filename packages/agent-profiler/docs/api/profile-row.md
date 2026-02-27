# ProfileRow Type Reference

The `ProfileRow` interface is the primary data record produced by each iteration of a profiling run, capturing every metric the profiler collects during a single agent execution.

**Source:** `packages/agent-profiler/src/types/profile-row.ts`

## Import

```typescript
import type { ProfileRow, CheckpointResult } from "@ghx-dev/agent-profiler"
```

## ProfileRow

Each profiling iteration produces exactly one `ProfileRow`. Rows are appended to JSONL result files and serve as the input to statistical analysis and report generation.

| Field | Type | Description |
|-------|------|-------------|
| `runId` | `string` | Identifier of the profiling run |
| `scenarioId` | `string` | Scenario that was executed |
| `mode` | `string` | Execution mode name |
| `model` | `string` | Model identifier |
| `iteration` | `number` | Zero-based repetition index |
| `startedAt` | `string` | ISO 8601 start timestamp |
| `completedAt` | `string` | ISO 8601 completion timestamp |
| `tokens` | `TokenBreakdown` | Token usage breakdown |
| `timing` | `TimingBreakdown` | Wall-clock and segment timing |
| `toolCalls` | `object` | Tool call statistics (total, byCategory, failed, retried, errorRate, records) |
| `cost` | `CostBreakdown` | Cost breakdown in USD |
| `success` | `boolean` | True when all checkpoints passed |
| `checkpointsPassed` | `number` | Passed checkpoint count |
| `checkpointsTotal` | `number` | Total checkpoint count |
| `checkpointDetails` | `CheckpointResult[]` | Per-checkpoint results |
| `outputValid` | `boolean` | Agent output format validity |
| `provider` | `string` | Provider identifier |
| `sessionId` | `string` | Provider-assigned session ID |
| `agentTurns` | `number` | Conversation turns completed |
| `completionReason` | `"stop" \| "timeout" \| "error" \| "tool_limit"` | Why the agent stopped |
| `extensions` | `Record<string, unknown>` | Custom metrics from collectors |
| `error?` | `string` | Error message if the iteration failed |
| `errorCode?` | `string` | Machine-readable error code |

### Usage Example

```typescript
import type { ProfileRow } from "@ghx-dev/agent-profiler"

function summarize(row: ProfileRow): string {
  const passRate = row.checkpointsTotal > 0
    ? (row.checkpointsPassed / row.checkpointsTotal * 100).toFixed(1)
    : "N/A"
  return `[${row.scenarioId}] iteration ${row.iteration}: ${passRate}% checkpoints, ${row.tokens.total} tokens, $${row.cost.totalUsd.toFixed(4)}`
}
```

## CheckpointResult

Each entry in the `checkpointDetails` array describes the outcome of a single checkpoint assertion evaluated against the agent output.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Checkpoint identifier |
| `description` | `string` | What the checkpoint verifies |
| `passed` | `boolean` | Whether it passed |
| `actual?` | `unknown` | Observed value |
| `expected?` | `unknown` | Expected value |

### Usage Example

```typescript
import type { CheckpointResult } from "@ghx-dev/agent-profiler"

function failedCheckpoints(details: CheckpointResult[]): CheckpointResult[] {
  return details.filter((cp) => !cp.passed)
}
```

## Related Documentation

- [Metric Types](./metric-types.md) -- detailed reference for `TokenBreakdown`, `TimingBreakdown`, `CostBreakdown`, and other nested types
- [Public API](./public-api.md) -- exported functions and classes that produce and consume `ProfileRow` records
- [Quick Start](../getting-started/quick-start.md) -- run your first profiling suite

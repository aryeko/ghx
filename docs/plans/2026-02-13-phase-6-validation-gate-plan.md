# Phase 6 Validation Gate Plan

Status: active.

## Objective

Implement the benchmark validation gate artifacts and reporting flow so release decisions can be made from repeatable measurements.

## Scope

In scope:
- `packages/benchmark/src/report/aggregate.ts`
- `packages/benchmark/src/cli/report.ts`
- `packages/benchmark/package.json` scripts for report and gate
- root scripts for benchmark reporting entrypoints
- benchmark report docs and usage updates

Out of scope:
- adding all 20+ scenarios in one change
- forcing gate pass without complete mode coverage data

## Workstreams

### 1) Summary Aggregation
1. Parse latest JSONL results by mode (`agent_direct`, `mcp`, `ghx_router`).
2. Compute median latency/tokens/tool calls and success/output-validity rates.
3. Compute deltas vs `agent_direct` when comparable rows are present.

### 2) Gate Evaluation
1. Apply thresholds from efficiency evaluation plan:
   - tokens reduction >= 25%
   - latency reduction >= 20%
   - tool call reduction >= 30%
   - success-rate drop <= 1pp
   - output validity >= 99%
2. Emit check-by-check pass/fail state and overall gate result.

### 3) Artifact Emission
1. Write machine-readable summary JSON:
   - `packages/benchmark/reports/latest-summary.json`
2. Write human-readable markdown summary:
   - `packages/benchmark/reports/latest-summary.md`
3. Support optional hard-fail mode for CI release gates.

### 4) Verification
1. Unit tests for aggregation and gate calculations.
2. Run benchmark package tests and typecheck.
3. Run workspace verification and benchmark checks.

## Exit Criteria

- Report command generates summary JSON + markdown artifacts.
- Gate mode fails process when thresholds are not met.
- Unit tests cover pass and fail gate cases.
- `pnpm run verify` and `pnpm run benchmark:check` are green.

# Benchmark Snapshot Schema

## Purpose
Defines the canonical JSON shape used to inject benchmark values into GTM drafts.

## Required Keys
1. `generated_at`
2. `provider_id`
3. `model_id`
4. `profile`
5. `sample_size`
6. `tokens_delta_pct`
7. `latency_delta_pct`
8. `tool_calls_delta_pct`
9. `success_rate`
10. `notes`

## Example Shape
```json
{
  "generated_at": "<ISO8601>",
  "provider_id": "openai",
  "model_id": "<MODEL_ID>",
  "profile": "verify_pr",
  "sample_size": "<N_RUNS>",
  "tokens_delta_pct": "<TOKENS_DELTA_PCT>",
  "latency_delta_pct": "<LATENCY_DELTA_PCT>",
  "tool_calls_delta_pct": "<TOOL_CALLS_DELTA_PCT>",
  "success_rate": "<SUCCESS_RATE>",
  "notes": "<NOTES>"
}
```

## Source of Truth
Read-only source branch: `plan/benchmark-scenarios-ghx-fixtures`.
Read-only source path: `/Users/aryekogan/repos/ghx/.worktrees/ghx-benchmark-worktree/packages/benchmark/reports/...`

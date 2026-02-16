# Medium Draft 01: Stop Paying Token Tax for GitHub Agent Workflows

## Hook
Every time an agent re-discovers GitHub command and API details, you spend extra tokens and time for work that should already be standardized.

## Problem
Most agent GitHub automation still relies on ad hoc command chains and context reconstruction. This creates brittle runs, noisy failure handling, and inconsistent outputs.

## Proof Framing
`ghx` defines a typed capability layer over GitHub execution routes with a stable envelope and deterministic behavior. Benchmark metrics will be inserted after final snapshot sign-off.

Metrics placeholders:
- Tokens delta: `<TOKENS_DELTA_PCT>`
- Latency delta: `<LATENCY_DELTA_PCT>`
- Tool-call delta: `<TOOL_CALLS_DELTA_PCT>`
- Success rate: `<SUCCESS_RATE>`
- Sample size: `<N_RUNS>`
- Model: `<MODEL_ID>`
- Benchmark date: `<BENCH_DATE>`

## Workflow Example
Use one capability for repo lookup without route re-discovery and custom output parsing every run.

## CTA
1. `npx @ghx-dev/core capabilities list`
2. `npx @ghx-dev/core run repo.view --input '{"owner":"aryeko","name":"ghx"}'`

## FAQ / Objections
1. "Why not just use gh directly?"
Answer: direct calls work, but they shift routing, retries, validation, and normalization into each agent run.
2. "Will this lock me into one route?"
Answer: no, `ghx` uses capability contracts and route planning while preserving output consistency.
3. "Should I trust performance claims before benchmark finalization?"
Answer: no numeric claim is final until snapshot sign-off; placeholders exist to enforce that rule.

# Medium Draft 02: How We Validate Agent GitHub Workflow Performance

## Hook
Performance claims in agent tooling are only useful when runs are repeatable, fixture quality is controlled, and output validity is checked.

## Method Overview
The benchmark process compares baseline `agent_direct` execution and `ghx` execution on equivalent scenario sets, with explicit output validation and failure checks.

## Proof Framing
Final benchmark values will be sourced from a single snapshot artifact after sign-off.

Metrics placeholders:
- Tokens delta: `<TOKENS_DELTA_PCT>`
- Latency delta: `<LATENCY_DELTA_PCT>`
- Tool-call delta: `<TOOL_CALLS_DELTA_PCT>`
- Success rate: `<SUCCESS_RATE>`
- Sample size: `<N_RUNS>`
- Model: `<MODEL_ID>`
- Benchmark date: `<BENCH_DATE>`

## Why This Matters
Without controlled fixture and scenario design, teams mistake fixture drift for product regressions. The benchmark process is designed to separate those concerns.

## CTA
1. `npx @ghx-dev/core capabilities list`
2. `npx @ghx-dev/core run repo.view --input '{"owner":"aryeko","name":"ghx"}'`

## FAQ / Objections
1. "Are these numbers comparable across models?"
Answer: only within the same declared model and profile context.
2. "Can I reuse the method in my repo?"
Answer: yes, with your own scenario fixtures and output validity gates.
3. "Why publish methodology before final numbers?"
Answer: it makes the claim process auditable and prevents metric drift.

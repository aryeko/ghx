# Content Placeholder Spec

## Mandatory Tokens
1. `<TOKENS_DELTA_PCT>`
2. `<LATENCY_DELTA_PCT>`
3. `<TOOL_CALLS_DELTA_PCT>`
4. `<SUCCESS_RATE>`
5. `<N_RUNS>`
6. `<MODEL_ID>`
7. `<BENCH_DATE>`

## Rules
1. Draft content must use placeholders until benchmark sign-off.
2. Replace placeholders in a single controlled pass.
3. Use one snapshot source for all channels.
4. Do not mix values from different runs.

## Replacement Procedure
1. Load finalized snapshot file.
2. Replace tokens across all GTM drafts.
3. Record source path and timestamp in `docs/gtm/launch-checklist.md`.
4. Re-run consistency checks before publishing.

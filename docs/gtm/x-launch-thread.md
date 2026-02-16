# X Launch Thread Draft

## Thread Goal
Announce `ghx` with a workflow-value narrative, then support with finalized benchmark snapshot values once available.

## Post 1
Hook: If your agent keeps re-learning how to do GitHub work every run, you are paying avoidable token and latency tax.
Proof framing: `ghx` adds a typed capability layer with deterministic execution behavior.
CTA: `npx @ghx-dev/core capabilities list`
FAQ objection: "Is this just another wrapper?" It standardizes contracts, validation, and outcomes for repeatable automation.

## Post 2
Hook: First run is the adoption test.
Proof framing: run a capability immediately after listing available tasks.
CTA: `npx @ghx-dev/core run repo.view --input '{"owner":"aryeko","name":"ghx"}'`
FAQ objection: "Do I need install setup first?" `npx` is enough to test initial value.

## Post 3
Hook: Performance claims are snapshot-gated.
Proof framing: placeholders replaced from one finalized artifact: `<TOKENS_DELTA_PCT>`, `<LATENCY_DELTA_PCT>`, `<TOOL_CALLS_DELTA_PCT>`, `<SUCCESS_RATE>`, `<N_RUNS>`, `<MODEL_ID>`, `<BENCH_DATE>`.
CTA: repeat CTA pair.
FAQ objection: "Why not publish early numbers?" Consistency and trust matter more than early hype.

## Post 4
Hook: Integration into existing ecosystems is the next distribution step.
Proof framing: first-wave plans target LangGraph, AutoGen, CrewAI, PydanticAI, and smolagents.
CTA: repeat CTA pair.
FAQ objection: "What if maintainers reject PRs?" fallback examples remain publishable in ghx docs.

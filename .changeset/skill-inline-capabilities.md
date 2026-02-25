---
"@ghx-dev/core": patch
---

Inline full capabilities list in SKILL.md and add per-iteration benchmark logging.

**SKILL.md: inline capabilities (eliminates discovery round-trip)**

Replaces the `## Discovery` section — which instructed agents to call `ghx capabilities list` to learn available operations — with an inline listing of all 70 capabilities directly in the skill prompt. Impact per benchmark session:

- Saves ~3.5s latency (one fewer LLM round-trip before any GitHub work starts)
- Saves ~3.8k tokens (capabilities list output no longer ingested as a tool result)
- Eliminates capability-name hallucinations (e.g. agents guessing `issue.get` instead of `issue.view`) observed in 40% of benchmark runs

`ghx capabilities explain <id>` is retained for full input/output schema lookups when needed.

**Benchmark: per-iteration structured logging and `report:iter`**

- Per-iteration session export: each benchmark run writes session logs, tool calls, and timing metadata to `iter-logs/<date>/<run>/<mode>/<scenario>/iter-N/session.jsonl`
- New `report:iter` CLI command generates a side-by-side per-iteration Markdown comparison report (tool calls, tokens, latency, capabilities invoked, bash commands, pass/fail) across execution modes
- GHX log staging and migration: ghx-side logs are moved into per-iteration directories after each run
- `BENCH_SESSION_WORKDIR` fix: restores the process working directory correctly after session teardown, preventing ENOENT on relative paths in subsequent runs

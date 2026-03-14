# @ghx-dev/agent-profiler

## 0.2.0

### Minor Changes

- aecc1e4: Add LLM-as-judge scoring with JudgeProvider contract, LlmJudgeScorer, CompositeScorer, and OpenCodeJudgeProvider. Enables rubric-based LLM evaluation of agent sessions via `--judge-model` CLI flag.

## 0.1.0

### Minor Changes

- 210404e: Add `@ghx-dev/agent-profiler` package: a plugin-first framework for profiling AI agent session performance with built-in collectors, analyzers, statistical engine, and multi-page markdown reporter.
- 4345e34: Redesign eval report output: add unified report.md with all metrics, analysis, and statistical comparisons in a single document. Redesign analysis.md with scenario-level cross-mode comparison tables, enriched tool names, color indicators, and efficiency analysis. Remove redundant pages (index.md, metrics.md, comparison.md, scenarios/\*.md). Fix float precision and empty list item formatting in analysis output.

### Patch Changes

- 97b87a7: Enforce prompt timeout via Promise.race in iteration runner and add error boundaries around page generators in reporter orchestrator.

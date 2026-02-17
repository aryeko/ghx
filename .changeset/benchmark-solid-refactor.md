---
"@ghx-dev/benchmark": patch
---

Refactor benchmark package internals for improved testability and maintainability (SOLID principles).

- Extract shared CLI flag-parsing utilities into `src/cli/flag-utils.ts`
- Extract shared CLI entry-point guard into `src/cli/entry.ts`
- Extract shared `isObject` guard into `src/utils/guards.ts`
- Extract shared JSONL parsing utilities into `src/utils/jsonl.ts`
- Extract shared `gh` CLI client for fixtures into `src/fixture/gh-client.ts`
- Consolidate JSON scanner utilities into `src/extract/envelope.ts`
- Extract envelope recovery logic into `src/runner/envelope-recovery.ts`
- Extract session polling helpers into `src/runner/session-polling.ts`
- Extract client lifecycle management into `src/runner/client-lifecycle.ts`
- Extract injectable runner config into `src/runner/config.ts`
- Unify `SuiteConfig` type via shared Zod schema in `src/cli/suite-config-schema.ts`
- Centralize report contract types into `src/domain/types.ts`
- Make `buildSummary` deterministic with optional timestamp parameter; fix O(n²) row grouping
- Add test coverage for `mcp` mode and multi-repetition runs
- Add shared scenario factory for test files

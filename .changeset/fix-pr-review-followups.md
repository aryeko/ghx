---
"@ghx-dev/core": patch
---

Refactor CLI capability adapter into domain modules with full unit test coverage.

**Refactoring:**

- Split monolithic `cli-capability-adapter.ts` (2200+ lines) into focused domain modules under `core/execution/adapters/cli/domains/`: `repo.ts`, `issue.ts`, `pr.ts`, `workflow.ts`, `project-v2.ts`, `release.ts`
- Extracted shared arg-building helpers to `cli/helpers.ts` (`buildRepoArg`, `buildPaginationArgs`, `buildFieldsFlag`, etc.)
- Added `cli/capability-registry.ts` — auto-discovers all handlers by spreading domain `handlers` maps; `cli-capability-adapter.ts` becomes a thin dispatcher

**Bug fixes:**

- `pr.ts`: Use `rerunAllResult.exitCode` (not `result.exitCode`) in `handlePrChecksRerunFailed` fallback error path
- `project-v2.ts`: Remove unreachable `SyntaxError` catch branch in `handleProjectV2ItemFieldUpdate` (no JSON parsing on the success path)
- `release.ts`: Fix misleading error message — `owner`/`name` are already validated by `requireRepo`; only `releaseId` can be invalid at that point
- `workflow.ts`: Track total error/warning counts independently of the 10-line collection cap in `handleWorkflowJobLogsGet`; type-narrow artifact `id` field consistently with other normalized fields

**Tests:**

- Added comprehensive unit test suites for all six domain modules (`cli-domains-*.test.ts`) and for the shared helpers (`cli-helpers.test.ts`) and capability registry (`cli-capability-registry.test.ts`) — all modified files at ≥90% branch coverage
- Refactored e2e tests to use proper `afterEach`/`afterAll` lifecycle hooks instead of ESLint rule suppressions

**Docs:**

- Updated `docs/architecture/adapters.md` and `docs/architecture/repository-structure.md` to reflect the new domain module layout

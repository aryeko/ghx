---
"@ghx-dev/core": patch
---

SOLID improvements: error handling, dead code removal, and testability.

- fix `mapErrorToCode` to use word-boundary regex for HTTP status codes and reorder checks to prevent keyword collisions
- fix `preflightCheck` to return `ADAPTER_UNSUPPORTED` for missing gh CLI instead of `VALIDATION`
- remove 7 unimplemented capability IDs from `GraphqlCapabilityId` union and update YAML cards to prefer CLI
- separate internal sentinel params (`__wasDraft`, `__effectiveRerunMode`) from `normalizeCliData` params into dedicated context arg
- consolidate duplicate AJV instances into shared `ajv-instance.ts`
- export `OperationCard` type from public API
- remove dead code: 66 unused task stubs, empty command scaffolds, stub formatter, unused `ExecutionMetrics` interface

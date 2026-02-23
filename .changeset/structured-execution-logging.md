---
"@ghx-dev/core": minor
---

Add structured JSONL execution logging. Emits log events at key points in the execution pipeline — preflight checks, route selection, adapter dispatch, retryable failures, and results — enabling consumers to subscribe to a structured event stream via `createExecuteTool`'s `onLog` option.

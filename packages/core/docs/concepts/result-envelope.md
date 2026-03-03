# Result Envelope

Every ghx operation — success or failure — returns a `ResultEnvelope`. This is the core API contract that makes ghx agent-friendly: your code always gets the same shape, no exceptions, no raw API payloads.

## Why a Stable Envelope?

AI agents waste tokens when API responses are unpredictable. With ghx:

- ✅ Check `result.ok` — no try/catch needed
- ✅ Typed `result.data` — consistent fields per capability
- ✅ Structured `result.error` — machine-readable error codes
- ✅ Rich `result.meta` — which route was used, why, and how long it took

## Type Definition

```ts
interface ResultEnvelope<TData = unknown> {
  ok: boolean
  data?: TData
  error?: ResultError
  meta: ResultMeta
}

interface ResultError {
  code: ErrorCode        // "AUTH", "NOT_FOUND", "RATE_LIMIT", "VALIDATION", ...
  message: string        // Human-readable description
  retryable: boolean     // Should the agent retry?
  details?: Record<string, unknown>
}

interface ResultMeta {
  capability_id: string
  route_used?: "cli" | "graphql" | "rest"
  reason?: RouteReasonCode
  attempts?: AttemptMeta[]
  pagination?: {
    has_next_page?: boolean
    end_cursor?: string
  }
  timings?: {
    total_ms?: number
    adapter_ms?: number
  }
}

interface AttemptMeta {
  route: "cli" | "graphql" | "rest"
  status: "success" | "error" | "skipped"
  error_code?: ErrorCode
  duration_ms?: number
}
```

## Success Example

```json
{
  "ok": true,
  "data": {
    "id": "PR_kwDOOx...",
    "title": "fix: resolve race condition in batch executor",
    "state": "OPEN",
    "number": 42
  },
  "meta": {
    "capability_id": "pr.view",
    "route_used": "graphql",
    "reason": "CARD_PREFERRED"
  }
}
```

## Error Example

```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Could not resolve to a PullRequest with the number 999",
    "retryable": false
  },
  "meta": {
    "capability_id": "pr.view",
    "route_used": "graphql",
    "reason": "CARD_PREFERRED",
    "attempts": [
      { "route": "graphql", "status": "error", "error_code": "NOT_FOUND", "duration_ms": 85 }
    ]
  }
}
```

## Fallback Example

When the preferred route fails and a fallback succeeds:

```json
{
  "ok": true,
  "data": { "title": "fix: race condition", "state": "OPEN" },
  "meta": {
    "capability_id": "pr.view",
    "route_used": "cli",
    "reason": "CARD_FALLBACK",
    "attempts": [
      { "route": "graphql", "status": "error", "error_code": "AUTH", "duration_ms": 30 },
      { "route": "cli", "status": "success", "duration_ms": 450 }
    ]
  }
}
```

## Chain Result Envelope

Batch operations via `executeTasks` return a `ChainResultEnvelope`:

```ts
interface ChainResultEnvelope {
  status: "success" | "partial" | "failed"
  results: ChainStepResult[]
  meta: {
    route_used: "cli" | "graphql" | "rest"
    total: number
    succeeded: number
    failed: number
  }
}

interface ChainStepResult {
  task: string
  ok: boolean
  data?: unknown
  error?: ResultError
}
```

| `status` | Meaning |
|---|---|
| `"success"` | All steps succeeded |
| `"partial"` | Some steps succeeded, some failed |
| `"failed"` | All steps failed |

## Agent Patterns

```ts
// Pattern 1: Simple check
const result = await executeTask(req, deps)
if (!result.ok) return handleError(result.error)
useData(result.data)

// Pattern 2: Retry on retryable errors
const result = await executeTask(req, deps)
if (!result.ok && result.error.retryable) {
  return retry(req)  // ghx already retried internally — this is an outer retry
}

// Pattern 3: Log routing info
console.log(`Used ${result.meta.route_used} (${result.meta.reason})`)
```

## Next Steps

- [Error Handling Guide](../guides/error-handling.md) — all error codes and retry strategies
- [Error Codes Reference](../reference/error-codes.md) — complete `ErrorCode` list
- [Types Reference](../reference/types.md) — full type definitions

# Error Codes Reference

All `ErrorCode` values defined in `@ghx-dev/core`.

## Error Codes

| Code | Constant | Retryable | Description |
|---|---|---|---|
| `AUTH` | `errorCodes.Auth` | No | Authentication failed — missing token, invalid token, or insufficient permissions |
| `NOT_FOUND` | `errorCodes.NotFound` | No | The requested resource does not exist (repo, issue, PR, workflow) |
| `VALIDATION` | `errorCodes.Validation` | No | Input does not conform to the operation card's `input_schema` (AJV validation) |
| `RATE_LIMIT` | `errorCodes.RateLimit` | **Yes** | GitHub API rate limit exceeded — retry after the reset window |
| `NETWORK` | `errorCodes.Network` | **Yes** | Network-level failure — DNS resolution, connection timeout, TLS error |
| `SERVER` | `errorCodes.Server` | **Yes** | GitHub returned a 5xx error — transient, retry likely to succeed |
| `ADAPTER_UNSUPPORTED` | `errorCodes.AdapterUnsupported` | No | The requested capability is not supported on the attempted route (e.g. no GraphQL handler) |
| `UNKNOWN` | `errorCodes.Unknown` | No | Unclassified error that doesn't match any known pattern |

## Retryability

ghx classifies three error codes as retryable: `RATE_LIMIT`, `NETWORK`, and `SERVER`. When the routing engine encounters a retryable error, it automatically retries on the same route (up to `maxAttemptsPerRoute`, default: 2) before falling back to the next route.

Your agent can check `result.error.retryable` for additional outer-layer retry logic:

```ts
if (!result.ok && result.error.retryable) {
  // Wait and retry — ghx already tried internally, but an outer retry may help
  // for transient network issues
}
```

## Error Mapping

Raw exceptions from adapters are mapped to error codes via `mapErrorToCode()`:

| Raw Error Pattern | → ErrorCode |
|---|---|
| `"Could not resolve"`, `"not found"` | `NOT_FOUND` |
| `"Bad credentials"`, `"401"` | `AUTH` |
| `"rate limit"`, `"403"` with rate limit headers | `RATE_LIMIT` |
| `"Resource not accessible"` | `AUTH` |
| Network/timeout errors | `NETWORK` |
| HTTP 5xx | `SERVER` |
| `"not supported"`, `"not implemented"` | `ADAPTER_UNSUPPORTED` |
| Everything else | `UNKNOWN` |

## Type Definition

```ts
const errorCodes = {
  Auth: "AUTH",
  NotFound: "NOT_FOUND",
  Validation: "VALIDATION",
  RateLimit: "RATE_LIMIT",
  Network: "NETWORK",
  Server: "SERVER",
  AdapterUnsupported: "ADAPTER_UNSUPPORTED",
  Unknown: "UNKNOWN",
} as const

type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes]
```

## Next Steps

- [Error Handling Guide](../guides/error-handling.md) — practical patterns for agents
- [Result Envelope](../concepts/result-envelope.md) — how errors fit into the envelope

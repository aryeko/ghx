# Telemetry

ghx uses structured logging throughout the execution pipeline. This guide explains how to read logs, set log levels, and debug routing decisions.

## Log Levels

| Level | What it shows |
|---|---|
| `error` | Unrecoverable failures (unsupported tasks, invariant violations) |
| `warn` | Recoverable issues (fallback triggered, retries) |
| `info` | Execution summaries (`execute.complete`, `execute_batch.complete`) |
| `debug` | Detailed tracing (routing decisions, adapter calls, resolution steps) |

Set via `GHX_LOG_LEVEL` environment variable:

```bash
GHX_LOG_LEVEL=debug ghx run pr.view --input '{"owner":"acme","name":"repo","prNumber":42}'
```

## Key Log Events

### Single Task Execution

| Event | Level | Fields |
|---|---|---|
| `execute.start` | debug | `capability_id` |
| `execute.complete` | info | `capability_id`, `ok`, `route_used`, `duration_ms`, `error_code` |

### Batch Execution

| Event | Level | Fields |
|---|---|---|
| `execute_batch.start` | debug | `count` |
| `execute_batch.complete` | info | `ok`, `status`, `total`, `succeeded`, `failed`, `duration_ms` |

### Adapter Events

| Event | Level | Fields |
|---|---|---|
| `graphql.start` | debug | `capability_id` |
| `graphql.complete` | debug | `capability_id`, `ok` |
| `cli.start` | debug | `capability_id` |
| `cli.complete` | debug | `capability_id`, `ok` |

### Resolution Events

| Event | Level | Fields |
|---|---|---|
| `resolution.lookup_scheduled` | debug | `step`, `operation` |
| `resolution.cache_hit` | debug | `step`, `operation`, `key` |
| `resolution.cache_set` | debug | `step`, `operation` |
| `resolution.step_resolved` | debug | `step`, `alias` |
| `query.batch_start` | debug | `count` |
| `query.batch_complete` | debug | `count` |

## Debugging Example

Investigate why a PR view fell back to CLI:

```bash
GHX_LOG_LEVEL=debug ghx run pr.view --input '{"owner":"acme","name":"repo","prNumber":42}'
```

Sample output:

```
[debug] execute.start { capability_id: "pr.view" }
[debug] graphql.start { capability_id: "pr.view" }
[debug] graphql.complete { capability_id: "pr.view", ok: false }
[debug] cli.start { capability_id: "pr.view" }
[debug] cli.complete { capability_id: "pr.view", ok: true }
[info]  execute.complete { capability_id: "pr.view", ok: true, route_used: "cli", duration_ms: 580 }
```

## Metrics via ResultEnvelope

Beyond logs, every `ResultEnvelope.meta` contains timing and routing data:

```ts
result.meta.timings?.total_ms    // total execution time
result.meta.timings?.adapter_ms  // time in the adapter
result.meta.route_used           // which route succeeded
result.meta.reason               // why this route was chosen
result.meta.attempts             // all route attempts with durations
```

## Next Steps

- [Error Handling](./error-handling.md) — using error info for debugging
- [Architecture: Execution Pipeline](../architecture/execution-pipeline.md) — where telemetry hooks in

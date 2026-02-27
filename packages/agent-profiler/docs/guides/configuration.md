# Configuration

Full reference for YAML configuration, CLI flags, and environment variables.

## YAML Configuration File

The profiler loads configuration from a YAML file via `loadConfig(yamlPath)`. The loader parses the YAML, converts `snake_case` keys to `camelCase`, and validates the result against a Zod schema (`ProfilerConfigSchema`). Each config section uses strict validation -- unknown keys are rejected.

### Complete Schema

```yaml
modes:
  - ghx
  - agent_direct

scenarios:
  set: core          # named set from scenario-sets.json
  ids:               # or explicit list
    - scenario-001

execution:
  repetitions: 5        # default: 5
  warmup: true           # default: true
  timeout_default_ms: 120000  # default: 120000
  allowed_retries: 0     # default: 0

output:
  results_dir: results   # default: "results"
  reports_dir: reports   # default: "reports"
  session_export: true   # default: true
  log_level: info        # default: "info"

extensions: {}           # arbitrary key-value
```

### Section Reference

#### modes

An array of mode names that the runner iterates over as the outermost loop. Each mode triggers a `ModeResolver.resolve()` call and a fresh `Provider.init()`.

```yaml
modes:
  - baseline
  - optimized
  - experimental
```

#### scenarios

Define which scenarios to run by referencing a named set or listing explicit IDs. When both `set` and `ids` are provided, `ids` takes precedence.

```yaml
# Option A: named set
scenarios:
  set: core

# Option B: explicit IDs
scenarios:
  ids:
    - pr-review-001
    - issue-triage-002
    - workflow-debug-003
```

#### execution

Controls how the runner executes iterations.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `repetitions` | `number` | `5` | Number of times each scenario runs per mode |
| `warmup` | `boolean` | `true` | Run a canary iteration before the main suite |
| `timeout_default_ms` | `number` | `120000` | Default prompt timeout in milliseconds |
| `allowed_retries` | `number` | `0` | Retries per iteration on failure |

#### output

Controls where results and reports are written.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `results_dir` | `string` | `"results"` | Directory for JSONL result files |
| `reports_dir` | `string` | `"reports"` | Directory for generated report output |
| `session_export` | `boolean` | `true` | Export full session traces for analysis |
| `log_level` | `string` | `"info"` | Logging verbosity: `"debug"`, `"info"`, `"warn"`, `"error"` |

#### extensions

An arbitrary key-value map for custom metadata. Values are passed through to scorers and collectors via scenario and context objects.

```yaml
extensions:
  team: platform
  environment: staging
  custom_threshold: 0.95
```

## CLI Flags

CLI flags override YAML configuration values. They are parsed by `parseProfilerFlags(argv, baseConfig)`, which returns a new config object with overrides merged immutably.

| Flag | Type | Description |
|------|------|-------------|
| `--mode` | `string` (repeatable) | Override modes list |
| `--scenario` | `string` (repeatable) | Override scenario IDs |
| `--scenario-set` | `string` | Override scenario set name |
| `--repetitions` | `number` | Override repetition count (must be >= 1) |
| `--retries` | `number` | Override allowed retries per iteration (must be >= 0) |
| `--skip-warmup` | `boolean` | Skip warmup canary iteration |

Flags that accept a value (`--mode`, `--scenario`, `--scenario-set`, `--repetitions`, `--retries`) throw an error if the value is missing or starts with `--`. Numeric flags (`--repetitions`, `--retries`) also validate that the value is a valid integer within range.

### Examples

Override modes and repetitions:

```bash
npx agent-profiler run --config profile.yaml --mode ghx --mode agent_direct --repetitions 10
```

Run a single scenario without warmup:

```bash
npx agent-profiler run --config profile.yaml --scenario pr-review-001 --skip-warmup
```

### Flag Precedence

CLI flags take precedence over YAML values. The merge is immutable: `parseProfilerFlags` returns a new config object without modifying the base config.

```text
CLI flags > YAML file > defaults
```

## Defaults Reference

All default values from `constants.ts`:

| Constant | Value | Description |
|----------|-------|-------------|
| `DEFAULT_REPETITIONS` | `5` | Repetitions per scenario per mode |
| `DEFAULT_WARMUP` | `true` | Run warmup canary before suite |
| `DEFAULT_TIMEOUT_MS` | `120000` | Default prompt timeout (2 minutes) |
| `DEFAULT_ALLOWED_RETRIES` | `0` | No retries on failure |
| `DEFAULT_RESULTS_DIR` | `"results"` | JSONL output directory |
| `DEFAULT_REPORTS_DIR` | `"reports"` | Report output directory |
| `DEFAULT_SESSION_EXPORT` | `true` | Export session traces |
| `DEFAULT_LOG_LEVEL` | `"info"` | Logging verbosity |

## Source Reference

- Config schema: `packages/agent-profiler/src/config/schema.ts`
- Config loader: `packages/agent-profiler/src/config/loader.ts`
- CLI flag parser: `packages/agent-profiler/src/config/loader.ts` (exported as `parseProfilerFlags`)
- Constants: `packages/agent-profiler/src/shared/constants.ts`

## Related Documentation

- [Quick Start](../getting-started/quick-start.md) -- complete runnable example
- [Scenarios](scenarios.md) -- scenario definition and sets
- [Reports](reports.md) -- output structure and interpretation
- [Profile Runner](../architecture/runner.md) -- how configuration drives execution
- [Installation](../getting-started/installation.md) -- prerequisites and setup

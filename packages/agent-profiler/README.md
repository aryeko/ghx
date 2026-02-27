# @ghx-dev/agent-profiler

A generic TypeScript framework for profiling AI agent session performance -- measuring latency, tokens, tool calls, cost, and behavioral patterns across execution modes.

## Why Agent Profiler?

| Concern | Eval Frameworks | Agent Profiler |
|---------|----------------|----------------|
| Success/failure | Checkpoints | Checkpoints via pluggable Scorer |
| Token efficiency | Not measured | Per-category breakdown (input, output, reasoning, cache) |
| Behavioral analysis | Not measured | 5 analyzers (reasoning, strategy, efficiency, tool-pattern, error) |
| Statistical rigor | Single-run pass/fail | Bootstrap CI, Cohen's d, permutation tests |

## Quick Start

```typescript
import {
  runProfileSuite,
  TokenCollector,
  LatencyCollector,
  CostCollector,
  ToolCallCollector,
  generateReport,
} from "@ghx-dev/agent-profiler"

const result = await runProfileSuite({
  modes: ["baseline", "optimized"],
  scenarios: [{ id: "task-1", name: "Task 1", description: "...", prompt: "...", timeoutMs: 30000, allowedRetries: 0, tags: [], extensions: {} }],
  repetitions: 5,
  allowedRetries: 0,
  provider: yourProvider,     // implements SessionProvider
  scorer: yourScorer,         // implements Scorer
  modeResolver: yourResolver, // implements ModeResolver
  collectors: [new TokenCollector(), new LatencyCollector(), new CostCollector(), new ToolCallCollector()],
  analyzers: [],
  hooks: {},
  warmup: true,
  sessionExport: true,
  outputJsonlPath: "/absolute/path/to/results.jsonl",
  logLevel: "info",
})

await generateReport({ runId: result.runId, rows: result.rows, reportsDir: "reports" })
```

## Built-in Metrics

- **TokenCollector** -- input, output, reasoning, cache-read, cache-write, total, active tokens
- **LatencyCollector** -- wall-clock time and per-segment durations
- **CostCollector** -- USD breakdown by token category
- **ToolCallCollector** -- total, failed, error rate, unique tools, per-category counts

## Plugin Contracts

| Contract | Purpose |
|----------|---------|
| `SessionProvider` | Drive agent sessions (create, prompt, export, destroy) |
| `Scorer` | Evaluate agent output against checkpoints |
| `Collector` | Extract custom metrics from prompt results |
| `Analyzer` | Produce structured findings from session traces |
| `ModeResolver` | Map mode names to environment and instructions |
| `RunHooks` | Lifecycle callbacks at run, mode, and iteration boundaries |

## Documentation

Full documentation: [docs/](./docs/)

- [Getting Started](./docs/getting-started/README.md) -- Installation, quick start, core concepts
- [Architecture](./docs/architecture/README.md) -- System design, plugin contracts, statistics engine
- [Guides](./docs/guides/README.md) -- Implementing providers, scorers, custom plugins, configuration
- [API Reference](./docs/api/README.md) -- Type reference and public API surface
- [Contributing](./docs/contributing/README.md) -- Development setup and adding plugins

## Requirements

- Node.js 22+
- TypeScript with strict mode

## License

See repository root for license information.

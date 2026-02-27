# Architecture

Central hub for `@ghx-dev/agent-profiler` architecture documentation.

## Pages

| Document | Description |
|----------|-------------|
| [System Overview](./overview.md) | End-to-end data flow from YAML configuration through execution to generated reports |
| [Profile Runner](./runner.md) | Matrix expansion, iteration lifecycle, retry logic, warmup, and hook invocation |
| [Plugin Contracts](./plugin-contracts.md) | All 6 extension interfaces with full type signatures and implementation gotchas |
| [Built-in Collectors](./built-in-collectors.md) | Reference for TokenCollector, LatencyCollector, CostCollector, and ToolCallCollector |
| [Built-in Analyzers](./built-in-analyzers.md) | Reference for reasoning, strategy, efficiency, tool-pattern, and error analyzers |
| [Statistics Engine](./statistics.md) | Descriptive stats, bootstrap CIs, effect sizes, permutation tests, and comparison API |

## Related Documentation

- [Getting Started](../getting-started/README.md)
- [Guides](../guides/README.md)
- [API Reference](../api/README.md)
- [Contributing](../contributing/README.md)

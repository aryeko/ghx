# Guides

Practical walkthroughs for implementing plugins, configuring the profiler, and interpreting reports.

## Available Guides

| Guide | Description |
|-------|-------------|
| [Implementing a Provider](implementing-a-provider.md) | Step-by-step guide to implementing the SessionProvider contract that drives agent sessions |
| [Implementing a Scorer](implementing-a-scorer.md) | Step-by-step guide to implementing the Scorer contract that evaluates agent output |
| [Custom Collectors](custom-collectors.md) | Create custom Collector implementations to extract domain-specific metrics |
| [Custom Analyzers](custom-analyzers.md) | Create custom Analyzer implementations to produce structured findings from session traces |
| [Configuration](configuration.md) | Full reference for YAML configuration, CLI flags, and environment variables |
| [Reports](reports.md) | Understand the report structure, output files, and how to interpret statistical results |
| [Scenarios](scenarios.md) | Understand the BaseScenario type, extending scenarios, sets, and the loader pattern |

## Where to Start

If you are integrating the profiler with a new agent runtime, start with [Implementing a Provider](implementing-a-provider.md). That is the primary integration point and the first plugin most consumers implement.

If you want to evaluate agent correctness, follow up with [Implementing a Scorer](implementing-a-scorer.md).

For fine-tuning execution parameters, see [Configuration](configuration.md). For understanding what the profiler produces, see [Reports](reports.md).

## Related Documentation

- [Quick Start](../getting-started/quick-start.md) -- complete runnable example in 50 lines
- [Core Concepts](../getting-started/concepts.md) -- mental model and plugin-first architecture
- [Plugin Contracts](../architecture/plugin-contracts.md) -- full interface definitions for all six contracts
- [Architecture Overview](../architecture/overview.md) -- system design and data flow

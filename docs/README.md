# ghx Documentation

Navigation hub for the ghx monorepo. Each package maintains its own documentation.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#4A90D9', 'primaryTextColor': '#fff', 'primaryBorderColor': '#2E6BA4', 'lineColor': '#666', 'fontSize': '13px'}}}%%
graph TD
  Hub["Documentation Hub"]

  Hub --> Core["@ghx-dev/core"]
  Hub --> Profiler["@ghx-dev/agent-profiler"]
  Hub --> Eval["@ghx-dev/eval"]
  Hub --> Repo["Repo-Wide"]

  click Core "../packages/core/docs/README.md"
  click Profiler "../packages/agent-profiler/docs/README.md"
  click Eval "../packages/eval/docs/README.md"

  style Hub fill:#4A90D9,color:#fff
  style Core fill:#9C27B0,color:#fff
  style Profiler fill:#F5A623,color:#fff
  style Eval fill:#E91E63,color:#fff
  style Repo fill:#7ED321,color:#000
```

## Packages

| Package | Description | Docs |
|---------|-------------|------|
| `@ghx-dev/core` | Public npm package -- CLI + capability routing engine | [packages/core/docs/](../packages/core/docs/README.md) |
| `@ghx-dev/agent-profiler` | Generic AI agent session profiler | [packages/agent-profiler/docs/](../packages/agent-profiler/docs/README.md) |
| `@ghx-dev/eval` | Evaluation harness for ghx benchmarking | [packages/eval/docs/](../packages/eval/docs/README.md) |

## Repo-Wide Documentation

- [Evaluation Report](eval-report.md) -- Empirical evaluation, statistical analysis, and bundled raw data
- [Repository Structure](repository-structure.md) -- Monorepo layout and module organization
- [Contributing](../CONTRIBUTING.md) -- Development setup, testing, CI, publishing
- [Roadmap](../ROADMAP.md) -- Current priorities and capability batches

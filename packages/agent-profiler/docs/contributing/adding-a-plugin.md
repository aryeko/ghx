# Adding a Built-in Plugin

Step-by-step guide to adding new built-in collectors or analyzers to the package.

## Adding a Collector

### 1. Create the Source File

Create `packages/agent-profiler/src/collector/<name>-collector.ts`:

```typescript
import type { Collector } from "../contracts/collector.js"
import type { PromptResult } from "../contracts/provider.js"
import type { CustomMetric } from "../types/metrics.js"
import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace } from "../types/trace.js"

export class MyCollector implements Collector {
  readonly id = "my_collector"

  async collect(
    result: PromptResult,
    _scenario: BaseScenario,
    _mode: string,
    _trace: SessionTrace | null,
  ): Promise<readonly CustomMetric[]> {
    return [
      { name: "my_metric", value: 42, unit: "count" },
    ]
  }
}
```

### 2. Export from the Public API

Add the new collector to `packages/agent-profiler/src/index.ts` so consumers can import it:

```typescript
import { MyCollector } from "@ghx-dev/agent-profiler"
```

### 3. Write Tests

Create `packages/agent-profiler/test/unit/collector/<name>-collector.test.ts` with unit tests covering the `collect` method, edge cases, and error paths. Aim for 90%+ coverage on the new file.

### 4. Update Documentation

Add the collector to `docs/architecture/built-in-collectors.md` with a description of the metrics it produces and when to use it.

## Adding an Analyzer

### 1. Create the Source File

Create `packages/agent-profiler/src/analyzer/<name>-analyzer.ts`. Use the `const` export pattern that existing analyzers follow:

```typescript
import type { Analyzer } from "../contracts/analyzer.js"
import type { BaseScenario } from "../types/scenario.js"
import type { AnalysisResult, SessionTrace } from "../types/trace.js"

export const myAnalyzer: Analyzer = {
  name: "my-analyzer",
  async analyze(
    trace: SessionTrace,
    _scenario: BaseScenario,
    _mode: string,
  ): Promise<AnalysisResult> {
    return {
      analyzer: "my-analyzer",
      findings: {
        example_finding: { type: "number", value: 0, unit: "count" },
      },
      summary: "My analysis summary",
    }
  },
}
```

### 2. Export from the Public API

Add the new analyzer to `packages/agent-profiler/src/index.ts` so consumers can import it:

```typescript
import { myAnalyzer } from "@ghx-dev/agent-profiler"
```

### 3. Write Tests

Create `packages/agent-profiler/test/unit/analyzer/<name>-analyzer.test.ts` with unit tests covering the `analyze` method, edge cases, and error paths. Aim for 90%+ coverage on the new file.

### 4. Update Documentation

Add the analyzer to `docs/architecture/built-in-analyzers.md` with a description of its findings and when to use it.

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Collector classes | PascalCase | `TokenCollector` |
| Analyzer instances | camelCase | `reasoningAnalyzer` |
| Collector IDs | snake_case | `"token"` |
| Analyzer names | kebab-case | `"reasoning"` |
| Metric names | snake_case | `"tokens_input"` |
| Files | kebab-case | `token-collector.ts` |
| Unit tests | `*.test.ts` | `token-collector.test.ts` |
| Integration tests | `*.integration.test.ts` | `store.integration.test.ts` |

## Pre-submission Checklist

- [ ] Implementation follows immutable patterns (`readonly`, no mutation)
- [ ] All fields documented with JSDoc
- [ ] Exported from `packages/agent-profiler/src/index.ts`
- [ ] Unit tests with 90%+ coverage
- [ ] Documentation updated

## Related Documentation

- [Plugin Contracts](../architecture/plugin-contracts.md)
- [Built-in Collectors](../architecture/built-in-collectors.md)
- [Built-in Analyzers](../architecture/built-in-analyzers.md)
- [Contributing Hub](./README.md)
- [Development Setup](./development-setup.md)

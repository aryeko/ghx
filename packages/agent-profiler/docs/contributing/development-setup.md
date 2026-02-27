# Development Setup

Clone the repository, install dependencies, and verify your development environment.

## Prerequisites

- **Node.js** 22 or later
- **pnpm** (latest stable)
- **git**

## Clone and Install

```bash
git clone https://github.com/aryeko/ghx.git
cd ghx
./scripts/setup-dev-env.sh
pnpm install
pnpm run build
```

## Verify the Agent Profiler Build

```bash
pnpm --filter @ghx-dev/agent-profiler run build
```

A successful build produces compiled output in `packages/agent-profiler/dist/`.

## Run Tests

```bash
pnpm --filter @ghx-dev/agent-profiler run test
pnpm --filter @ghx-dev/agent-profiler run test:coverage
```

The coverage target is 90% (aim for 95%).

### Run a Single Test

Filter by file path or test name:

```bash
pnpm --filter @ghx-dev/agent-profiler exec vitest run test/unit/runner/profile-runner.test.ts
pnpm --filter @ghx-dev/agent-profiler exec vitest run -t "runProfileSuite"
```

## Project Structure

```text
packages/agent-profiler/
  src/
    analyzer/       # Built-in analyzers (5)
    collector/      # Built-in collectors (4)
    config/         # Config schema and loader
    contracts/      # Plugin contracts (6)
    reporter/       # Report generation
    runner/         # Profile runner and iteration
    shared/         # Logger and constants
    stats/          # Statistics engine
    store/          # JSONL store and manifests
    types/          # Core type definitions
    index.ts        # Public API
  test/
    unit/           # Unit tests (mirrors src/)
    integration/    # Integration tests
    helpers/        # Test utilities and mocks
```

## Path Aliases

The package defines the `@profiler/*` alias, which maps to `packages/agent-profiler/src/*`. Use it for imports that cross two or more directory levels. Single-level relative imports (`./`, `../`) remain as-is.

```typescript
// Cross-package alias
import { ProfileRunner } from "@profiler/runner/profile-runner.js"

// Same-directory relative import
import { formatMetric } from "./format.js"
```

## Related Documentation

- [Contributing Hub](./README.md)
- [Adding a Plugin](./adding-a-plugin.md)
- [Architecture](../architecture/README.md)

# Installation

Install `@ghx-dev/agent-profiler` and verify the setup.

## Prerequisites

- **Node.js 22+** -- the package uses modern ES module features that require Node 22 or later
- **TypeScript strict mode** -- the package is authored with `strict: true` and expects consumers to do the same
- **pnpm** (monorepo) or **npm** -- any Node-compatible package manager works

## Install

With pnpm (recommended for monorepos):

```bash
pnpm add @ghx-dev/agent-profiler
```

With npm:

```bash
npm install @ghx-dev/agent-profiler
```

## Peer Dependencies

None. `@ghx-dev/agent-profiler` is a standalone package with no required peer dependencies.

## Verify the Setup

Create a small script to confirm the package is importable and the primary entry point resolves correctly:

```typescript
import { runProfileSuite } from "@ghx-dev/agent-profiler"

console.log(typeof runProfileSuite) // "function"
```

Run it with your preferred TypeScript executor (e.g., `tsx`, `ts-node`, or compile-then-run). If the output prints `function`, the installation is complete.

## Source Reference

The public API surface is exported from `packages/agent-profiler/src/index.ts`.

## Related Documentation

- [Getting Started Hub](README.md) -- overview of all getting-started pages
- [Quick Start](quick-start.md) -- complete runnable example
- [Core Concepts](concepts.md) -- mental model and plugin-first architecture
- [Architecture Overview](../architecture/README.md) -- system design and data flow

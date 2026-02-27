# Contributing to @ghx-dev/core

This guide covers development setup, testing, and code conventions specific to the `packages/core` package.

## Development Setup

### Prerequisites

- Node.js 22+
- pnpm 9+
- `gh` CLI authenticated (`gh auth status`)
- `GITHUB_TOKEN` environment variable

### Setup

```bash
# From the repo root
pnpm install

# Build core
cd packages/core
pnpm run build
```

### Common Commands

| Command | Description |
|---|---|
| `pnpm run build` | Build with tsup |
| `pnpm run typecheck` | TypeScript type checking |
| `pnpm run lint` | ESLint + Biome check |
| `pnpm run format` | Auto-fix formatting |
| `pnpm run test` | Run unit tests |
| `pnpm run test:watch` | Watch mode for unit tests |
| `pnpm run test:coverage` | Unit tests with coverage |
| `pnpm run test:e2e:local` | E2E tests (local, no API calls) |
| `pnpm run test:e2e:sdk` | E2E tests (requires `OPENAI_API_KEY`) |

## GraphQL Codegen

When modifying `.graphql` operations or the GitHub schema:

```bash
# Regenerate TypeScript types from .graphql files
pnpm run gql:generate

# Refresh the GitHub GraphQL schema (requires GITHUB_TOKEN)
pnpm run gql:schema:refresh

# Verify generated code is in sync with .graphql files
pnpm run gql:verify
```

## Test Structure

```
test/
├── unit/          Unit tests — no network calls, fast
├── integration/   Integration tests — test module boundaries
├── e2e/           End-to-end tests — real API calls
├── fixtures/      Shared test fixtures
└── helpers/       Test utilities
```

- **Unit tests** cover: registry loading, schema validation, error mapping, routing logic, normalization
- **Integration tests** cover: adapter → registry → handler chains
- **E2E tests** cover: real GitHub API calls via the full execution pipeline

## Code Style

- TypeScript strict mode
- Biome for formatting, ESLint for linting
- No default exports
- Explicit return types on public functions
- TSDoc on all public exports

## Adding a New Capability

See the dedicated guide: [Adding a Capability](../guides/adding-a-capability.md)

## CI

The CI pipeline runs:
1. `typecheck` — TypeScript compilation
2. `lint` — ESLint + Biome
3. `test` — Unit tests
4. `test:e2e:local` — Local E2E tests
5. `gql:verify` — Generated code sync check
6. `plugin:sync:check` — Plugin manifest sync check

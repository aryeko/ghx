# Benchmark Package

Benchmark tooling for `ghx`.

## Commands

- `pnpm --filter @ghx-dev/benchmark run run -- agent_direct 1 --scenario pr-view-001`
- `pnpm --filter @ghx-dev/benchmark run run -- ghx_router 1 --scenario-set pr-exec`
- `pnpm --filter @ghx-dev/benchmark run run -- ghx_router 1 --scenario-set issues`
- `pnpm --filter @ghx-dev/benchmark run run -- ghx_router 1 --scenario-set release-delivery`
- `pnpm --filter @ghx-dev/benchmark run run -- ghx_router 1 --scenario-set workflows`
- `pnpm --filter @ghx-dev/benchmark run run -- ghx_router 1 --scenario-set projects-v2`
- `pnpm --filter @ghx-dev/benchmark run report`
- `pnpm --filter @ghx-dev/benchmark run report:gate`
- `pnpm --filter @ghx-dev/benchmark run test`
- `pnpm --filter @ghx-dev/benchmark run typecheck`

## Roadmap Scenario Sets

- `default` remains stable and mutation-free
- `pr-exec`
- `issues`
- `release-delivery`
- `workflows`
- `projects-v2`
- `all` is the exact union of A-D

## Scope

- Scenario schemas and validation
- Parsing and extraction helpers
- CLI entrypoint for benchmark execution
- Suite runner and OpenCode SDK integration
- Benchmark summary report and validation gate output

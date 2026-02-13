# Routing Policy

Defines how tasks are routed across `cli`, `rest`, and `graphql`.

## Current Runtime Behavior

- Task-specific defaults come from `packages/ghx-router/src/core/routing/capability-registry.ts`.
- Generic fallback route comes from `packages/ghx-router/src/core/routing/policy.ts`.

Current shipped task entries default to GraphQL.

Only bypass configured defaults with documented reason codes:

- `coverage_gap`
- `efficiency_gain`
- `output_shape_requirement`

## Source of Truth

- Runtime behavior: `packages/ghx-router/src/core/routing/`
- Policy matrix: `README.md` (Routing Decision Matrix)
- Detailed architecture rationale: `docs/architecture/system-design.md`

This file should remain concise and mirror runtime policy.

# Routing Policy

Routing is card-driven and deterministic.

## Planning Rules

For a given capability card:

1. start with `routing.preferred`
2. append ordered `routing.fallbacks`
3. de-duplicate route order
4. apply preflight checks per route

## Route Reasons

Runtime reason codes:

- `CARD_PREFERRED`
- `CARD_FALLBACK`
- `PREFLIGHT_FAILED`
- `ENV_CONSTRAINT`
- `CAPABILITY_LIMIT`
- `DEFAULT_POLICY`

## Current Shape

- Route policy is card-defined per capability; do not assume a single global pattern
- Examples in current cards:
  - `repo.view`, `issue.view`, `issue.list`, `pr.view`, `pr.list` use `preferred=cli`, `fallbacks=[graphql]`
  - `issue.comments.list` uses `preferred=graphql`, `fallbacks=[cli]`
  - PR review-read and PR thread mutation capabilities are GraphQL-only (`fallbacks=[]`)
  - CI diagnostics/log capabilities are CLI-only (`fallbacks=[]`)
- global route preference order remains `cli`, then `graphql` when policies allow both
- REST is planned but not part of active preference ordering
- `execute` performs bounded per-route retries and then fallback

Source of truth:

- `packages/core/src/core/registry/cards/*.yaml`
- `packages/core/src/core/execute/execute.ts`
- `packages/core/src/core/execution/preflight.ts`

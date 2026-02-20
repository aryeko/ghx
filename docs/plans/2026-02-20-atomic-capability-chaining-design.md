# Atomic Capability Chaining Design

**Date:** 2026-02-20
**Branch:** `feat/atomic-chaining`
**Status:** Approved

## Problem

The current execution model supports one capability per tool call. Agents that need to perform multiple related GitHub mutations (e.g., resolve a PR thread and post a comment) must make separate tool calls, each incurring a round-trip. Composite capability cards (`pr.threads.composite`, `issue.triage.composite`, `issue.update.composite`) were introduced as a workaround but require pre-authoring a YAML card for every fixed combination — a maintenance burden that doesn't scale.

## Goal

Allow callers to specify an arbitrary list of `[capabilityId, input]` pairs in a single tool call. Steps execute in a two-phase batch — resolution queries batched together (≤ 1 HTTP call), then mutations batched together (≤ 1 HTTP call) — reducing agent round-trips to at most 2 HTTP calls for any chain, regardless of length.

## Decisions

| Question | Decision |
|---|---|
| Dynamic or card-based? | Dynamic runtime API — no card needed at call site |
| Input data flow | All inputs specified upfront; no inter-step data flow |
| Error model | Pre-flight: whole chain rejected on any validation failure. Runtime: partial results — per-step ok/error |
| Routes supported | GraphQL only — CLI doesn't support chaining |
| Composite cards | Deleted — never published (0.1.2 is last release) |
| API surface | `executeTasks` (primary) + `executeTask` as 1-item wrapper |
| Resolution config | Declared in YAML operation cards via `graphql.resolution` — no separate TypeScript registry |
| Execution model | Two-phase batch: Phase 1 = batch resolution queries (≤ 1 call), Phase 2 = batch mutations (≤ 1 call) |
| Single-step behaviour | 1-item `executeTasks` → falls through to existing routing engine; existing handlers unchanged |
| CLI interface | `ghx chain --steps '<json>' \| --steps -` |

## Card-Defined Resolution

Multi-step capabilities (those that currently do an internal ID lookup before their mutation) declare their resolution requirements in `card.graphql.resolution`. This schema is added to existing cards; capabilities that don't need resolution have no `resolution` field.

### Resolution schema (YAML)

```yaml
graphql:
  operationName: IssueLabelsUpdate
  documentPath: src/gql/operations/issue-labels-update.graphql
  resolution:
    lookup:
      operationName: IssueLabelsLookup
      documentPath: src/gql/operations/issue-labels-lookup.graphql
      vars:
        issueId: issueId            # lookupVar: inputField (same-name mapping)
    inject:
      - target: labelIds            # mutation variable to populate
        source: map_array
        from_input: labels          # input field — array of human-readable names
        nodes_path: node.repository.labels.nodes   # dot-path into lookup result
        match_field: name           # field in each node matched against input value
        extract_field: id           # field in each node extracted as ID
```

### Two inject sources

| source | description | required fields |
|---|---|---|
| `scalar` | Single value extracted from lookup result | `path` (dot-notation into result) |
| `map_array` | Array of names mapped to IDs via a lookup table | `from_input`, `nodes_path`, `match_field`, `extract_field` |

### Cards requiring resolution

| Card | Lookup operation | Inject source | Target var |
|---|---|---|---|
| `issue.labels.update` | `IssueLabelsLookup(issueId)` | `map_array` | `labelIds` |
| `issue.labels.add` | `IssueLabelsLookup(issueId)` | `map_array` | `labelIds` |
| `issue.assignees.update` | `IssueAssigneesLookup(issueId)` | `map_array` | `assigneeIds` |
| `issue.milestone.set` | `IssueMilestoneLookup(issueId, milestoneNumber)` | `scalar` | `milestoneId` |
| `issue.parent.remove` | `IssueParentLookup(issueId)` | `scalar` | `parentIssueId` |
| `issue.create` | `IssueCreateRepositoryId(owner, name)` | `scalar` | `repositoryId` |

### Variable pass-through

Mutation variables not covered by `inject` entries are populated by matching the input field with the same name (e.g., mutation var `issueId` ← `input.issueId`). Input fields that don't correspond to a mutation variable are silently ignored (they may have been consumed by `resolution.lookup.vars`).

## API Contract

### New types

```ts
type ChainStatus = "success" | "partial" | "failed"

interface ChainStepResult {
  task: string
  ok: boolean
  data?: unknown
  error?: ResultError
}

interface ChainResultEnvelope {
  status: ChainStatus   // success = all ok, partial = some ok, failed = none ok
  results: ChainStepResult[]
  meta: {
    route_used: "graphql"
    total: number
    succeeded: number
    failed: number
  }
}
```

### Resolution types (TypeScript, internal)

```ts
interface ScalarInject {
  target: string
  source: "scalar"
  path: string           // dot-notation into lookup result
}

interface MapArrayInject {
  target: string
  source: "map_array"
  from_input: string
  nodes_path: string
  match_field: string
  extract_field: string
}

type InjectSpec = ScalarInject | MapArrayInject

interface ResolutionConfig {
  lookup: {
    operationName: string
    documentPath: string
    vars: Record<string, string>   // lookupVar: inputField
  }
  inject: InjectSpec[]
}
```

### `executeTasks` — new primary function

```ts
executeTasks(
  requests: Array<{ task: string; input: Record<string, unknown> }>,
  deps: ExecutionDeps,
): Promise<ChainResultEnvelope>
```

- **1 item:** full routing engine with CLI fallback (identical to current `executeTask` behaviour)
- **2+ items:** GraphQL-only two-phase batch; pre-flight rejects whole chain if any step has no `card.graphql`

### `executeTask` — thin wrapper (unchanged signature)

```ts
async function executeTask(
  request: TaskRequest,
  deps: ExecutionDeps,
): Promise<ResultEnvelope> {
  const chain = await executeTasks([request], deps)
  const step = chain.results[0]
  return {
    ok: step.ok,
    data: step.data,
    error: step.error,
    meta: { capability_id: step.task, route_used: "graphql", ... },
  }
}
```

No existing callsites change.

### New public exports

```ts
export { executeTasks } from "./core/routing/engine.js"
export type { ChainResultEnvelope, ChainStepResult, ChainStatus } from "./core/contracts/envelope.js"
```

### CLI interface

```
ghx chain --steps '<json-array>'
ghx chain --steps -           # read from stdin
```

`--steps` accepts a JSON array of `{ task, input }` objects — identical structure to `executeTasks` requests. Mirrors `ghx run --input` ergonomics. Output is the `ChainResultEnvelope` serialised as JSON.

## Execution Engine

### Pre-flight (2+ items only)

For each `{ task, input }`:
1. `getOperationCard(task)` — reject whole chain if not found
2. Validate `input` against `card.input_schema` (AJV)
3. Assert `card.graphql` exists — all chainable caps must have a GQL route

Pre-flight failures reject the entire chain before any HTTP call.

### Phase 1 — Resolution batch query (≤ 1 HTTP call)

Collect all steps that have `card.graphql.resolution`. For each:
1. Build lookup variables by mapping `resolution.lookup.vars` (`{ lookupVar: inputField }`) against `step.input`
2. Load the lookup document string from `LOOKUP_DOCUMENTS[resolution.lookup.operationName]` (a thin TypeScript registry mapping operation name → pre-imported document string)
3. Accumulate into `buildBatchQuery` call

Execute the combined batch query once. Parse aliased results back per step.

Also batch any pure-query steps (capabilities where the GQL operation is a `query`, not a `mutation`) into this same Phase 1 call. Pure-query steps complete in Phase 1.

**HTTP calls in Phase 1:** 0 (no resolution or query steps) or 1.

### Phase 2 — Mutation batch (≤ 1 HTTP call)

For each mutation step:
1. Start with input fields that match mutation variable names (pass-through)
2. Apply `inject` specs from `card.graphql.resolution` using Phase 1 results:
   - `scalar`: extract value at dot-path from aliased lookup result
   - `map_array`: build name→ID map from lookup nodes; resolve `input[from_input]` array to IDs
3. Load mutation document string from `MUTATION_DOCUMENTS[card.graphql.operationName]`
4. Accumulate into `buildBatchMutation` call

Execute combined batch mutation once. Map aliased results back per step.

**HTTP calls in Phase 2:** 0 (no mutation steps) or 1.

### Result assembly

```ts
const succeeded = results.filter(r => r.ok).length
const status: ChainStatus =
  succeeded === results.length ? "success" :
  succeeded === 0              ? "failed"  : "partial"

return {
  status,
  results,
  meta: { route_used: "graphql", total: results.length, succeeded, failed: results.length - succeeded },
}
```

### HTTP call summary

| Chain composition | Phase 1 | Phase 2 | Total |
|---|---|---|---|
| Pure queries only | 1 | 0 | 1 |
| Mutations, no resolution | 0 | 1 | 1 |
| Mutations with resolution | 1 | 1 | 2 |
| Mixed queries + mutations | 1 | 1 | 2 |

### `buildBatchQuery` — new function in `gql/batch.ts`

Mirrors `buildBatchMutation` but emits `query BatchChain(...)` instead of `mutation BatchComposite(...)`. `parseMutation` is generalised to `parseOperation` to handle both keywords.

## Migration

### Deletions

| What | Location |
|---|---|
| `expandCompositeSteps` | `core/execute/composite.ts` → delete file |
| `executeComposite` | `core/routing/engine.ts` |
| `CompositeConfig`, `CompositeStep` types | `core/registry/types.ts` |
| `composite?` field on `OperationCard` | `core/registry/types.ts` |
| `composite` property in card JSON schema | `core/registry/operation-card-schema.ts` |
| Composite IDs from `preferredOrder` | `core/registry/index.ts` |
| `pr.threads.composite.yaml` | `core/registry/cards/` |
| `issue.triage.composite.yaml` | `core/registry/cards/` |
| `issue.update.composite.yaml` | `core/registry/cards/` |

### Additions

| What | Location |
|---|---|
| `graphql.resolution` field on `OperationCard` | `core/registry/types.ts` |
| `resolution` property in card JSON schema | `core/registry/operation-card-schema.ts` |
| `resolution:` blocks in 6 capability cards | `core/registry/cards/*.yaml` |
| `buildBatchQuery`, `parseOperation` | `gql/batch.ts` |
| `LOOKUP_DOCUMENTS`, `MUTATION_DOCUMENTS` registries | `gql/document-registry.ts` (new file) |
| `executeTasks` | `core/routing/engine.ts` |
| `ChainResultEnvelope`, `ChainStepResult`, `ChainStatus` | `core/contracts/envelope.ts` |
| `ghx chain` subcommand | `cli/commands/chain.ts` |
| Dispatch in CLI entry | `cli/index.ts` |
| New exports | `index.ts` |

### Changeset

Delete `composite-capabilities-gql-integration.md`. Create new `minor` changeset — `executeTasks` is additive; composite removal is not breaking since composites were never published (current released version: `0.1.2`).

## Validation

### Runtime (this PR)

Pre-flight rejects any step without `card.graphql` before issuing any HTTP call:

```
"capability 'pr.checks.rerun_failed' has no GraphQL route and cannot be chained"
```

### Schema enforcement (follow-up PR)

39 of ~60 current cards lack a `graphql` config. Adding graphql support to all caps and making `graphql` required in `operation-card-schema.ts` is scoped to a follow-up PR.

# Atomic Capability Chaining Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `executeTasks` — a two-phase batch API letting callers execute multiple capabilities in ≤ 2 GitHub API calls — while deleting the composite card system that was never published.

**Architecture:** Card-defined resolution (`graphql.resolution` in YAML) declares ID-lookup requirements per capability. The batch engine reads these at runtime: Phase 1 batches all resolution queries + pure-query steps into one HTTP call; Phase 2 batches all mutations into one HTTP call. Single-step `executeTask` is a thin wrapper that preserves existing behaviour exactly.

**Tech Stack:** TypeScript strict ESM, Vitest, AJV (schema validation), `graphql-request` (GQL transport), Biome (formatter). Monorepo: `pnpm` + Nx. All work in `.worktrees/feat-atomic-chaining`.

---

## Context You Need

- **Worktree:** `.worktrees/feat-atomic-chaining` (branch `feat/atomic-chaining`)
- **Key files:** `packages/core/src/`
  - `gql/batch.ts` — existing `buildBatchMutation`, `parseMutation`
  - `gql/capability-registry.ts` — existing handler registry (read it, don't change it in these tasks)
  - `gql/operations/*.generated.ts` — generated SDK files; export `*Document` strings and `getSdk`
  - `core/routing/engine.ts` — `executeTask`, `executeComposite` (to be removed)
  - `core/contracts/envelope.ts` — `ResultEnvelope`, `ResultError`, `ResultMeta`
  - `core/registry/types.ts` — `OperationCard`, `CompositeConfig`, `CompositeStep`
  - `core/registry/operation-card-schema.ts` — JSON schema for YAML cards
  - `core/registry/index.ts` — card loading, `preferredOrder` array
  - `core/execute/composite.ts` — `expandCompositeSteps` (to be deleted)
  - `cli/index.ts` — main CLI dispatcher
  - `cli/commands/run.ts` — reference for `chain.ts` patterns
  - `index.ts` — public exports
- **Design doc:** `docs/plans/2026-02-20-atomic-capability-chaining-design.md` — read this for full type definitions and schemas
- **Test pattern:** existing `test/unit/*.test.ts` files for style; run single test with `pnpm --filter @ghx-dev/core exec vitest run <file>`
- **Format:** run `pnpm run format` after each task to let Biome auto-fix; then `pnpm run typecheck` to catch type errors
- **Commit:** after each passing task

---

## Task 1: Extend `OperationCard` type and JSON schema for `graphql.resolution`

**Files:**
- Modify: `packages/core/src/core/registry/types.ts`
- Modify: `packages/core/src/core/registry/operation-card-schema.ts`
- Test: `packages/core/test/unit/operation-card-schema.test.ts` (may not exist — create it)

**Step 1: Write the failing test**

Create `packages/core/test/unit/operation-card-schema.test.ts`:

```ts
import Ajv from "ajv"
import { describe, expect, it } from "vitest"
import { operationCardSchema } from "@core/core/registry/operation-card-schema.js"

const ajv = new Ajv()
const validate = ajv.compile(operationCardSchema)

describe("operationCardSchema resolution", () => {
  it("accepts a card with scalar resolution", () => {
    const card = {
      capability_id: "issue.milestone.set",
      version: "1.0.0",
      description: "Set milestone",
      input_schema: { type: "object" },
      output_schema: { type: "object" },
      routing: { preferred: "graphql", fallbacks: [] },
      graphql: {
        operationName: "IssueMilestoneSet",
        documentPath: "src/gql/operations/issue-milestone-set.graphql",
        resolution: {
          lookup: {
            operationName: "IssueMilestoneLookup",
            documentPath: "src/gql/operations/issue-milestone-lookup.graphql",
            vars: { issueId: "issueId", milestoneNumber: "milestoneNumber" },
          },
          inject: [{ target: "milestoneId", source: "scalar", path: "node.repository.milestone.id" }],
        },
      },
    }
    expect(validate(card)).toBe(true)
  })

  it("accepts a card with map_array resolution", () => {
    const card = {
      capability_id: "issue.labels.update",
      version: "1.0.0",
      description: "Update labels",
      input_schema: { type: "object" },
      output_schema: { type: "object" },
      routing: { preferred: "graphql", fallbacks: [] },
      graphql: {
        operationName: "IssueLabelsUpdate",
        documentPath: "src/gql/operations/issue-labels-update.graphql",
        resolution: {
          lookup: {
            operationName: "IssueLabelsLookup",
            documentPath: "src/gql/operations/issue-labels-lookup.graphql",
            vars: { issueId: "issueId" },
          },
          inject: [
            {
              target: "labelIds",
              source: "map_array",
              from_input: "labels",
              nodes_path: "node.repository.labels.nodes",
              match_field: "name",
              extract_field: "id",
            },
          ],
        },
      },
    }
    expect(validate(card)).toBe(true)
  })

  it("rejects resolution with unknown source", () => {
    const card = {
      capability_id: "x",
      version: "1.0.0",
      description: "x",
      input_schema: { type: "object" },
      output_schema: { type: "object" },
      routing: { preferred: "graphql", fallbacks: [] },
      graphql: {
        operationName: "X",
        documentPath: "x.graphql",
        resolution: {
          lookup: { operationName: "Y", documentPath: "y.graphql", vars: {} },
          inject: [{ target: "t", source: "unknown_source", path: "a.b" }],
        },
      },
    }
    expect(validate(card)).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/operation-card-schema.test.ts
```
Expected: FAIL — `resolution` property is not in the schema

**Step 3: Add `ResolutionConfig` types to `types.ts`**

In `packages/core/src/core/registry/types.ts`, add after the existing interfaces (keep `CompositeConfig` for now — it's deleted in Task 9):

```ts
export interface ScalarInject {
  target: string
  source: "scalar"
  path: string
}

export interface MapArrayInject {
  target: string
  source: "map_array"
  from_input: string
  nodes_path: string
  match_field: string
  extract_field: string
}

export type InjectSpec = ScalarInject | MapArrayInject

export interface ResolutionConfig {
  lookup: {
    operationName: string
    documentPath: string
    vars: Record<string, string>
  }
  inject: InjectSpec[]
}
```

Also extend the `graphql?` field on `OperationCard` to include `resolution?`:

```ts
graphql?: {
  operationName: string
  documentPath: string
  variables?: Record<string, string>
  limits?: { maxPageSize?: number }
  resolution?: ResolutionConfig
}
```

**Step 4: Add `resolution` to `operation-card-schema.ts`**

Inside the `graphql` property object, add `resolution` alongside `operationName`, `documentPath`, etc.:

```ts
resolution: {
  type: "object",
  required: ["lookup", "inject"],
  properties: {
    lookup: {
      type: "object",
      required: ["operationName", "documentPath", "vars"],
      properties: {
        operationName: { type: "string", minLength: 1 },
        documentPath: { type: "string", minLength: 1 },
        vars: { type: "object" },
      },
      additionalProperties: false,
    },
    inject: {
      type: "array",
      minItems: 1,
      items: {
        oneOf: [
          {
            type: "object",
            required: ["target", "source", "path"],
            properties: {
              target: { type: "string", minLength: 1 },
              source: { const: "scalar" },
              path: { type: "string", minLength: 1 },
            },
            additionalProperties: false,
          },
          {
            type: "object",
            required: ["target", "source", "from_input", "nodes_path", "match_field", "extract_field"],
            properties: {
              target: { type: "string", minLength: 1 },
              source: { const: "map_array" },
              from_input: { type: "string", minLength: 1 },
              nodes_path: { type: "string", minLength: 1 },
              match_field: { type: "string", minLength: 1 },
              extract_field: { type: "string", minLength: 1 },
            },
            additionalProperties: false,
          },
        ],
      },
    },
  },
  additionalProperties: false,
},
```

Note: also remove `additionalProperties: false` from the parent `graphql` object temporarily — it's already there; just insert `resolution` into its `properties`.

**Step 5: Run tests**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/operation-card-schema.test.ts
```
Expected: PASS

**Step 6: Typecheck**

```bash
pnpm run typecheck
```
Expected: PASS (new optional field, backwards-compatible)

**Step 7: Commit**

```bash
cd .worktrees/feat-atomic-chaining
git add packages/core/src/core/registry/types.ts packages/core/src/core/registry/operation-card-schema.ts packages/core/test/unit/operation-card-schema.test.ts
git commit -m "feat(core): add graphql.resolution schema and types to OperationCard"
```

---

## Task 2: Add `resolution:` blocks to the 6 capability YAML cards

**Files:**
- Modify: `packages/core/src/core/registry/cards/issue.labels.update.yaml`
- Modify: `packages/core/src/core/registry/cards/issue.labels.add.yaml`
- Modify: `packages/core/src/core/registry/cards/issue.assignees.update.yaml`
- Modify: `packages/core/src/core/registry/cards/issue.milestone.set.yaml`
- Modify: `packages/core/src/core/registry/cards/issue.parent.remove.yaml`
- Modify: `packages/core/src/core/registry/cards/issue.create.yaml`
- Test: `packages/core/test/unit/registry.test.ts` (existing — check card loading still works)

**Step 1: Write a failing test**

In `packages/core/test/unit/registry.test.ts` (or create if absent), add:

```ts
import { describe, expect, it } from "vitest"
import { getOperationCard } from "@core/core/registry/index.js"

describe("card resolution blocks", () => {
  it("issue.labels.update has resolution config", () => {
    const card = getOperationCard("issue.labels.update")
    expect(card.graphql?.resolution).toBeDefined()
    expect(card.graphql?.resolution?.lookup.operationName).toBe("IssueLabelsLookup")
    expect(card.graphql?.resolution?.inject[0].source).toBe("map_array")
  })

  it("issue.milestone.set has scalar resolution", () => {
    const card = getOperationCard("issue.milestone.set")
    expect(card.graphql?.resolution?.inject[0].source).toBe("scalar")
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/registry.test.ts -t "card resolution blocks"
```
Expected: FAIL — cards don't have resolution yet

**Step 3: Add resolution blocks to all 6 cards**

**`issue.labels.update.yaml`** — append to `graphql:` section:
```yaml
  resolution:
    lookup:
      operationName: IssueLabelsLookup
      documentPath: src/gql/operations/issue-labels-lookup.graphql
      vars:
        issueId: issueId
    inject:
      - target: labelIds
        source: map_array
        from_input: labels
        nodes_path: node.repository.labels.nodes
        match_field: name
        extract_field: id
```

**`issue.labels.add.yaml`** — same resolution block as `issue.labels.update.yaml` (same lookup, same inject, since `IssueLabelsAdd` also takes `labelIds`).

**`issue.assignees.update.yaml`** — append to `graphql:` section:
```yaml
  resolution:
    lookup:
      operationName: IssueAssigneesLookup
      documentPath: src/gql/operations/issue-assignees-lookup.graphql
      vars:
        issueId: issueId
    inject:
      - target: assigneeIds
        source: map_array
        from_input: assignees
        nodes_path: node.repository.assignableUsers.nodes
        match_field: login
        extract_field: id
```

**`issue.milestone.set.yaml`** — append to `graphql:` section:
```yaml
  resolution:
    lookup:
      operationName: IssueMilestoneLookup
      documentPath: src/gql/operations/issue-milestone-lookup.graphql
      vars:
        issueId: issueId
        milestoneNumber: milestoneNumber
    inject:
      - target: milestoneId
        source: scalar
        path: node.repository.milestone.id
```

**`issue.parent.remove.yaml`** — append to `graphql:` section:
```yaml
  resolution:
    lookup:
      operationName: IssueParentLookup
      documentPath: src/gql/operations/issue-parent-lookup.graphql
      vars:
        issueId: issueId
    inject:
      - target: parentIssueId
        source: scalar
        path: node.parent.id
```

**`issue.create.yaml`** — append to `graphql:` section:
```yaml
  resolution:
    lookup:
      operationName: IssueCreateRepositoryId
      documentPath: src/gql/operations/issue-create-repository-id.graphql
      vars:
        owner: owner
        name: name
    inject:
      - target: repositoryId
        source: scalar
        path: repository.id
```

**Step 4: Run test**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/registry.test.ts -t "card resolution blocks"
```
Expected: PASS

**Step 5: Run all core tests**

```bash
pnpm --filter @ghx-dev/core exec vitest run
```
Expected: All pass (card loading validates against schema; new field passes AJV)

**Step 6: Commit**

```bash
git add packages/core/src/core/registry/cards/ packages/core/test/unit/registry.test.ts
git commit -m "feat(core): add graphql.resolution blocks to 6 capability cards"
```

---

## Task 3: Add `buildBatchQuery` and generalise `parseOperation` in `gql/batch.ts`

**Files:**
- Modify: `packages/core/src/gql/batch.ts`
- Test: `packages/core/test/unit/batch.test.ts` (existing — extend it)

**Step 1: Write failing tests**

In `packages/core/test/unit/batch.test.ts`, add:

```ts
import { buildBatchQuery } from "@core/gql/batch.js"

describe("buildBatchQuery", () => {
  it("wraps single query with alias", () => {
    const result = buildBatchQuery([
      {
        alias: "step0",
        query: `query IssueLabelsLookup($issueId: ID!) {
  node(id: $issueId) {
    ... on Issue { id }
  }
}`,
        variables: { issueId: "I_123" },
      },
    ])
    expect(result.document).toContain("query BatchChain")
    expect(result.document).toContain("step0:")
    expect(result.document).toContain("$step0_issueId: ID!")
    expect(result.variables).toEqual({ step0_issueId: "I_123" })
  })

  it("merges two queries", () => {
    const q = `query Foo($id: ID!) { node(id: $id) { id } }`
    const result = buildBatchQuery([
      { alias: "a", query: q, variables: { id: "1" } },
      { alias: "b", query: q, variables: { id: "2" } },
    ])
    expect(result.document).toContain("$a_id: ID!")
    expect(result.document).toContain("$b_id: ID!")
    expect(result.variables).toEqual({ a_id: "1", b_id: "2" })
  })

  it("throws on empty array", () => {
    expect(() => buildBatchQuery([])).toThrow()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/batch.test.ts -t "buildBatchQuery"
```
Expected: FAIL — `buildBatchQuery` not exported

**Step 3: Generalise `parseMutation` → `parseOperation` and add `buildBatchQuery`**

In `packages/core/src/gql/batch.ts`:

1. Rename `parseMutation` to `parseOperation` (keep it private). Change the regex to match `query|mutation` keyword instead of just `mutation`:

```ts
function parseOperation(document: string): ParsedOperation {
  const headerMatch = document.match(/(query|mutation)\s+\w+\s*\(([^)]*)\)/)
  // ... rest identical, but use headerMatch[2] for var string (group 2 now)
}
```

2. Update `buildBatchMutation` to call `parseOperation` instead of `parseMutation`.

3. Add `buildBatchQuery`:

```ts
export type BatchQueryInput = {
  alias: string
  query: string
  variables: GraphqlVariables
}

export type BatchQueryResult = {
  document: string
  variables: GraphqlVariables
}

export function buildBatchQuery(operations: BatchQueryInput[]): BatchQueryResult {
  if (operations.length === 0) {
    throw new Error("buildBatchQuery requires at least one operation")
  }

  const allVarDeclarations: string[] = []
  const allSelections: string[] = []
  const mergedVariables: GraphqlVariables = {}

  for (const op of operations) {
    const parsed = parseOperation(op.query)

    for (const varDecl of parsed.variableDeclarations) {
      allVarDeclarations.push(`$${op.alias}_${varDecl.name}: ${varDecl.type}`)
    }

    let body = parsed.body
    const sortedDeclarations = [...parsed.variableDeclarations].sort(
      (a, b) => b.name.length - a.name.length,
    )
    for (const varDecl of sortedDeclarations) {
      body = body.replaceAll(
        new RegExp(`\\$${escapeRegex(varDecl.name)}\\b`, "g"),
        `$${op.alias}_${varDecl.name}`,
      )
    }

    const aliasedBody = body.replace(/^\s*(\w+)/, `${op.alias}: $1`)
    allSelections.push(aliasedBody)

    for (const [key, value] of Object.entries(op.variables)) {
      mergedVariables[`${op.alias}_${key}`] = value
    }
  }

  const varList = allVarDeclarations.length > 0 ? `(${allVarDeclarations.join(", ")})` : ""
  const document = `query BatchChain${varList} {\n${allSelections.join("\n")}\n}`

  return { document, variables: mergedVariables }
}
```

**Step 4: Run tests**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/batch.test.ts
```
Expected: All pass (new tests + existing mutation tests still pass)

**Step 5: Typecheck and commit**

```bash
pnpm run typecheck
git add packages/core/src/gql/batch.ts packages/core/test/unit/batch.test.ts
git commit -m "feat(core): add buildBatchQuery and generalise parseOperation in batch.ts"
```

---

## Task 4: Create `gql/document-registry.ts` (lookup + mutation document strings)

**Files:**
- Create: `packages/core/src/gql/document-registry.ts`
- Test: `packages/core/test/unit/document-registry.test.ts`

**Step 1: Write failing test**

Create `packages/core/test/unit/document-registry.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { getLookupDocument, getMutationDocument } from "@core/gql/document-registry.js"

describe("document-registry", () => {
  it("getLookupDocument returns document for IssueLabelsLookup", () => {
    const doc = getLookupDocument("IssueLabelsLookup")
    expect(doc).toContain("query IssueLabelsLookup")
  })

  it("getLookupDocument returns document for IssueMilestoneLookup", () => {
    const doc = getLookupDocument("IssueMilestoneLookup")
    expect(doc).toContain("milestoneNumber")
  })

  it("getMutationDocument returns document for IssueLabelsUpdate", () => {
    const doc = getMutationDocument("IssueLabelsUpdate")
    expect(doc).toContain("mutation IssueLabelsUpdate")
  })

  it("getLookupDocument throws on unknown operation", () => {
    expect(() => getLookupDocument("UnknownOp")).toThrow()
  })

  it("getMutationDocument throws on unknown operation", () => {
    expect(() => getMutationDocument("UnknownOp")).toThrow()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/document-registry.test.ts
```

**Step 3: Create `gql/document-registry.ts`**

Import the `*Document` constants from generated files and build two registries:

```ts
import { IssueAssigneesLookupDocument } from "./operations/issue-assignees-lookup.generated.js"
import { IssueCreateRepositoryIdDocument } from "./operations/issue-create-repository-id.generated.js"
import { IssueLabelsLookupDocument } from "./operations/issue-labels-lookup.generated.js"
import { IssueMilestoneLookupDocument } from "./operations/issue-milestone-lookup.generated.js"
import { IssueParentLookupDocument } from "./operations/issue-parent-lookup.generated.js"

// Resolution lookup queries (Phase 1)
const LOOKUP_DOCUMENTS: Record<string, string> = {
  IssueLabelsLookup: IssueLabelsLookupDocument,
  IssueAssigneesLookup: IssueAssigneesLookupDocument,
  IssueMilestoneLookup: IssueMilestoneLookupDocument,
  IssueParentLookup: IssueParentLookupDocument,
  IssueCreateRepositoryId: IssueCreateRepositoryIdDocument,
}
```

For mutations, import from the relevant generated files. You need to check which generated files export a `*Document` constant — look at files like `issue-labels-update.generated.ts`, `issue-milestone-set.generated.ts`, etc. and import the document strings. Add entries for all capabilities that have a `graphql` config (at minimum the 6 that have resolution, plus others used in `capability-registry.ts`).

```ts
export function getLookupDocument(operationName: string): string {
  const doc = LOOKUP_DOCUMENTS[operationName]
  if (!doc) {
    throw new Error(`No lookup document registered for operation: ${operationName}`)
  }
  return doc
}

export function getMutationDocument(operationName: string): string {
  const doc = MUTATION_DOCUMENTS[operationName]
  if (!doc) {
    throw new Error(`No mutation document registered for operation: ${operationName}`)
  }
  return doc
}
```

**Step 4: Run test**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/document-registry.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/gql/document-registry.ts packages/core/test/unit/document-registry.test.ts
git commit -m "feat(core): add document-registry for lookup and mutation GQL documents"
```

---

## Task 5: Add chain types to `core/contracts/envelope.ts`

**Files:**
- Modify: `packages/core/src/core/contracts/envelope.ts`
- Test: `packages/core/test/unit/envelope.test.ts` (may not exist — create)

**Step 1: Write failing test**

```ts
import { describe, expect, it } from "vitest"
import type { ChainResultEnvelope, ChainStatus, ChainStepResult } from "@core/core/contracts/envelope.js"

describe("ChainResultEnvelope types", () => {
  it("status type accepts valid values", () => {
    const s1: ChainStatus = "success"
    const s2: ChainStatus = "partial"
    const s3: ChainStatus = "failed"
    expect([s1, s2, s3]).toHaveLength(3)
  })

  it("ChainStepResult can be ok", () => {
    const r: ChainStepResult = { task: "issue.close", ok: true, data: { id: "x" } }
    expect(r.ok).toBe(true)
  })

  it("ChainResultEnvelope has expected shape", () => {
    const env: ChainResultEnvelope = {
      status: "success",
      results: [{ task: "issue.close", ok: true }],
      meta: { route_used: "graphql", total: 1, succeeded: 1, failed: 0 },
    }
    expect(env.meta.total).toBe(1)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/envelope.test.ts -t "ChainResultEnvelope"
```

**Step 3: Add to `envelope.ts`**

```ts
export type ChainStatus = "success" | "partial" | "failed"

export interface ChainStepResult {
  task: string
  ok: boolean
  data?: unknown
  error?: ResultError
}

export interface ChainResultEnvelope {
  status: ChainStatus
  results: ChainStepResult[]
  meta: {
    route_used: "graphql"
    total: number
    succeeded: number
    failed: number
  }
}
```

**Step 4: Run test, typecheck, commit**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/envelope.test.ts
pnpm run typecheck
git add packages/core/src/core/contracts/envelope.ts packages/core/test/unit/envelope.test.ts
git commit -m "feat(core): add ChainResultEnvelope, ChainStepResult, ChainStatus types"
```

---

## Task 6: Create the resolution engine helper (`gql/resolve.ts`)

This module contains the logic to:
- Extract a resolved value from a lookup result using an `InjectSpec`
- Build final mutation variables for a step by combining pass-through input vars with resolved vars

**Files:**
- Create: `packages/core/src/gql/resolve.ts`
- Test: `packages/core/test/unit/resolve.test.ts`

**Step 1: Write failing tests**

Create `packages/core/test/unit/resolve.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { applyInject, buildMutationVars } from "@core/gql/resolve.js"
import type { InjectSpec } from "@core/core/registry/types.js"

describe("applyInject", () => {
  it("scalar: extracts value at dot-path", () => {
    const lookupResult = { node: { repository: { milestone: { id: "M_456" } } } }
    const spec: InjectSpec = { target: "milestoneId", source: "scalar", path: "node.repository.milestone.id" }
    expect(applyInject(spec, lookupResult, {})).toEqual({ milestoneId: "M_456" })
  })

  it("scalar: throws when path not found", () => {
    const spec: InjectSpec = { target: "milestoneId", source: "scalar", path: "node.repository.milestone.id" }
    expect(() => applyInject(spec, {}, {})).toThrow("milestoneId")
  })

  it("map_array: maps names to ids", () => {
    const lookupResult = {
      node: { repository: { labels: { nodes: [{ id: "L_1", name: "bug" }, { id: "L_2", name: "feat" }] } } },
    }
    const spec: InjectSpec = {
      target: "labelIds",
      source: "map_array",
      from_input: "labels",
      nodes_path: "node.repository.labels.nodes",
      match_field: "name",
      extract_field: "id",
    }
    const input = { labels: ["feat", "bug"] }
    expect(applyInject(spec, lookupResult, input)).toEqual({ labelIds: ["L_2", "L_1"] })
  })

  it("map_array: throws when name not found", () => {
    const lookupResult = { node: { repository: { labels: { nodes: [] } } } }
    const spec: InjectSpec = {
      target: "labelIds",
      source: "map_array",
      from_input: "labels",
      nodes_path: "node.repository.labels.nodes",
      match_field: "name",
      extract_field: "id",
    }
    const input = { labels: ["nonexistent"] }
    expect(() => applyInject(spec, lookupResult, input)).toThrow("nonexistent")
  })
})

describe("buildMutationVars", () => {
  it("passes through vars matching mutation variable names", () => {
    const mutDoc = `mutation IssueClose($issueId: ID!) { closeIssue(input: {issueId: $issueId}) { issue { id } } }`
    const input = { issueId: "I_123", extraField: "ignored" }
    const resolved: Record<string, unknown> = {}
    const vars = buildMutationVars(mutDoc, input, resolved)
    expect(vars).toEqual({ issueId: "I_123" })
  })

  it("resolved vars override pass-through", () => {
    const mutDoc = `mutation IssueLabelsUpdate($issueId: ID!, $labelIds: [ID!]!) { updateIssue(input: {id: $issueId, labelIds: $labelIds}) { issue { id } } }`
    const input = { issueId: "I_123", labels: ["bug"] }
    const resolved = { labelIds: ["L_1"] }
    const vars = buildMutationVars(mutDoc, input, resolved)
    expect(vars).toEqual({ issueId: "I_123", labelIds: ["L_1"] })
  })
})
```

**Step 2: Run to verify failure**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/resolve.test.ts
```

**Step 3: Implement `gql/resolve.ts`**

```ts
import type { InjectSpec } from "@core/core/registry/types.js"
import type { GraphqlVariables } from "./transport.js"

function getAtPath(obj: unknown, path: string): unknown {
  const parts = path.split(".")
  let current = obj
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function applyInject(
  spec: InjectSpec,
  lookupResult: unknown,
  input: Record<string, unknown>,
): Record<string, unknown> {
  if (spec.source === "scalar") {
    const value = getAtPath(lookupResult, spec.path)
    if (value === undefined || value === null) {
      throw new Error(`Resolution failed for '${spec.target}': no value at path '${spec.path}'`)
    }
    return { [spec.target]: value }
  }

  // map_array
  const nodes = getAtPath(lookupResult, spec.nodes_path)
  if (!Array.isArray(nodes)) {
    throw new Error(`Resolution failed for '${spec.target}': nodes at '${spec.nodes_path}' is not an array`)
  }

  const idByName = new Map<string, unknown>()
  for (const node of nodes) {
    if (node && typeof node === "object") {
      const n = node as Record<string, unknown>
      const key = n[spec.match_field]
      const val = n[spec.extract_field]
      if (typeof key === "string") {
        idByName.set(key.toLowerCase(), val)
      }
    }
  }

  const inputValues = input[spec.from_input]
  if (!Array.isArray(inputValues)) {
    throw new Error(`Resolution failed for '${spec.target}': input field '${spec.from_input}' is not an array`)
  }

  const resolved = inputValues.map((name: unknown) => {
    if (typeof name !== "string") throw new Error(`Resolution: expected string in '${spec.from_input}'`)
    const id = idByName.get(name.toLowerCase())
    if (id === undefined) throw new Error(`Resolution: '${name}' not found in lookup result`)
    return id
  })

  return { [spec.target]: resolved }
}

export function buildMutationVars(
  mutationDoc: string,
  input: Record<string, unknown>,
  resolved: Record<string, unknown>,
): GraphqlVariables {
  // Extract variable names declared in the mutation header
  const headerMatch = mutationDoc.match(/(?:query|mutation)\s+\w+\s*\(([^)]*)\)/)
  const mutVarNames = new Set<string>()
  if (headerMatch?.[1]) {
    for (const match of headerMatch[1].matchAll(/\$(\w+)\s*:/g)) {
      if (match[1]) mutVarNames.add(match[1])
    }
  }

  const vars: GraphqlVariables = {}
  // Pass through input fields whose names match mutation variables
  for (const varName of mutVarNames) {
    if (varName in input) {
      vars[varName] = input[varName] as GraphqlVariables[string]
    }
  }
  // Apply resolved values (may override pass-through)
  for (const [key, value] of Object.entries(resolved)) {
    if (mutVarNames.has(key)) {
      vars[key] = value as GraphqlVariables[string]
    }
  }
  return vars
}
```

**Step 4: Run tests**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/resolve.test.ts
```
Expected: PASS

**Step 5: Typecheck and commit**

```bash
pnpm run typecheck
git add packages/core/src/gql/resolve.ts packages/core/test/unit/resolve.test.ts
git commit -m "feat(core): add resolution engine helpers (applyInject, buildMutationVars)"
```

---

## Task 7: Implement `executeTasks` in `core/routing/engine.ts`

**Files:**
- Modify: `packages/core/src/core/routing/engine.ts`
- Test: `packages/core/test/unit/engine.test.ts` (existing — extend)

**Step 1: Read `engine.ts` before modifying**

Read `packages/core/src/core/routing/engine.ts` in full. Understand how `executeTask`, `executeComposite`, and `ExecutionDeps` are structured.

**Step 2: Write failing tests**

In `packages/core/test/unit/engine.test.ts`, add a section for `executeTasks`. You'll need to mock:
- `getOperationCard` (from `@core/core/registry/index.js`)
- `getLookupDocument`, `getMutationDocument` (from `@core/gql/document-registry.js`)
- The HTTP transport (`githubClient`)

Use `vi.mock` to mock those modules. Test key behaviours:

```ts
describe("executeTasks", () => {
  it("rejects whole chain pre-flight if card not found", async () => {
    // mock getOperationCard to throw
    // expect executeTasks to return status: "failed" with pre-flight error
  })

  it("rejects whole chain pre-flight if card has no graphql config", async () => {
    // mock getOperationCard to return card without graphql
    // expect status: "failed"
  })

  it("1-item chain delegates to existing executeTask path (full routing)", async () => {
    // Verify that executeTasks([singleItem]) calls the same path as executeTask
    // Check the returned ChainResultEnvelope has 1 result
  })

  it("2-item pure-mutation chain returns status:success after batch mutation", async () => {
    // Mock two cards (no resolution), mock HTTP client to return batch results
    // expect 1 HTTP call (Phase 2 only), status: "success"
  })

  it("status is partial when one step fails", async () => {
    // Mock one step success, one step failure from HTTP client
    // expect status: "partial", results[0].ok=true, results[1].ok=false
  })
})
```

Write the tests first even if they are somewhat high-level — you can refine them as you implement.

**Step 3: Run to verify failures**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts -t "executeTasks"
```

**Step 4: Implement `executeTasks` in `engine.ts`**

Add after the existing `executeTask` function:

```ts
import { buildBatchMutation, buildBatchQuery } from "../../gql/batch.js"
import { getLookupDocument, getMutationDocument } from "../../gql/document-registry.js"
import { applyInject, buildMutationVars } from "../../gql/resolve.js"
import type { ChainResultEnvelope, ChainStepResult, ChainStatus } from "../contracts/envelope.js"

export async function executeTasks(
  requests: Array<{ task: string; input: Record<string, unknown> }>,
  deps: ExecutionDeps,
): Promise<ChainResultEnvelope> {
  // 1-item: delegate to existing routing engine
  if (requests.length === 1) {
    const req = requests[0]!
    const result = await executeTask({ task: req.task, input: req.input }, deps)
    const step: ChainStepResult = result.ok
      ? { task: req.task, ok: true, data: result.data }
      : { task: req.task, ok: false, error: result.error }
    return {
      status: result.ok ? "success" : "failed",
      results: [step],
      meta: { route_used: "graphql", total: 1, succeeded: result.ok ? 1 : 0, failed: result.ok ? 0 : 1 },
    }
  }

  // Pre-flight: validate all steps
  const preflightErrors: ChainStepResult[] = []
  const cards: Array<ReturnType<typeof getOperationCard>> = []
  for (const req of requests) {
    try {
      const card = getOperationCard(req.task)
      validateInput(req.input, card.input_schema)
      if (!card.graphql) throw new Error(`capability '${req.task}' has no GraphQL route and cannot be chained`)
      cards.push(card)
    } catch (err) {
      preflightErrors.push({ task: req.task, ok: false, error: mapError(err) })
    }
  }

  if (preflightErrors.length > 0) {
    return {
      status: "failed",
      results: requests.map(
        (req) => preflightErrors.find((e) => e.task === req.task) ?? { task: req.task, ok: false, error: { code: "UNKNOWN", message: "pre-flight failed" } },
      ),
      meta: { route_used: "graphql", total: requests.length, succeeded: 0, failed: requests.length },
    }
  }

  // Phase 1: batch resolution queries (steps with card.graphql.resolution)
  // Also batch pure-query steps here (future: detect by GQL keyword; for now, assume all steps are mutations)
  const lookupInputs: Array<{ alias: string; query: string; variables: Record<string, unknown>; stepIndex: number }> = []
  for (let i = 0; i < requests.length; i++) {
    const card = cards[i]!
    const req = requests[i]!
    if (card.graphql?.resolution) {
      const { lookup } = card.graphql.resolution
      const lookupVars: Record<string, unknown> = {}
      for (const [lookupVar, inputField] of Object.entries(lookup.vars)) {
        lookupVars[lookupVar] = req.input[inputField]
      }
      lookupInputs.push({
        alias: `step${i}`,
        query: getLookupDocument(lookup.operationName),
        variables: lookupVars,
        stepIndex: i,
      })
    }
  }

  const lookupResults: Record<number, unknown> = {}
  if (lookupInputs.length > 0) {
    const { document, variables } = buildBatchQuery(
      lookupInputs.map(({ alias, query, variables }) => ({ alias, query, variables: variables as import("../../gql/transport.js").GraphqlVariables })),
    )
    const rawResult = await deps.githubClient.request(document, variables)
    // Un-alias results: BatchChain result has keys like "step0", "step2", etc.
    for (const { alias, stepIndex } of lookupInputs) {
      lookupResults[stepIndex] = (rawResult as Record<string, unknown>)[alias]
    }
  }

  // Phase 2: batch mutations
  const mutationInputs: Array<{ alias: string; mutation: string; variables: import("../../gql/transport.js").GraphqlVariables; stepIndex: number }> = []
  const stepPreResults: Record<number, ChainStepResult> = {}

  for (let i = 0; i < requests.length; i++) {
    const card = cards[i]!
    const req = requests[i]!

    try {
      const resolved: Record<string, unknown> = {}
      if (card.graphql?.resolution && lookupResults[i] !== undefined) {
        for (const spec of card.graphql.resolution.inject) {
          Object.assign(resolved, applyInject(spec, lookupResults[i], req.input))
        }
      }

      const mutDoc = getMutationDocument(card.graphql!.operationName)
      const mutVars = buildMutationVars(mutDoc, req.input, resolved)
      mutationInputs.push({ alias: `step${i}`, mutation: mutDoc, variables: mutVars, stepIndex: i })
    } catch (err) {
      stepPreResults[i] = { task: req.task, ok: false, error: mapError(err) }
    }
  }

  let rawMutResult: Record<string, unknown> = {}
  if (mutationInputs.length > 0) {
    try {
      const { document, variables } = buildBatchMutation(
        mutationInputs.map(({ alias, mutation, variables }) => ({ alias, mutation, variables })),
      )
      rawMutResult = (await deps.githubClient.request(document, variables)) as Record<string, unknown>
    } catch (err) {
      // Whole batch mutation failed — mark all pending steps as failed
      for (const { stepIndex, alias: _alias } of mutationInputs) {
        const req = requests[stepIndex]!
        stepPreResults[stepIndex] = { task: req.task, ok: false, error: mapError(err) }
      }
    }
  }

  // Assemble results
  const results: ChainStepResult[] = requests.map((req, i) => {
    if (stepPreResults[i]) return stepPreResults[i]!
    const mutInput = mutationInputs.find((m) => m.stepIndex === i)
    if (!mutInput) return { task: req.task, ok: false, error: { code: "UNKNOWN" as const, message: "step skipped" } }
    const data = rawMutResult[mutInput.alias]
    return { task: req.task, ok: true, data }
  })

  const succeeded = results.filter((r) => r.ok).length
  const status: ChainStatus =
    succeeded === results.length ? "success" : succeeded === 0 ? "failed" : "partial"

  return {
    status,
    results,
    meta: { route_used: "graphql", total: results.length, succeeded, failed: results.length - succeeded },
  }
}
```

Note: `mapError` and `validateInput` are existing internal helpers in `engine.ts` — use them as they're already there. Check the actual signatures by reading the file before implementing. Also check how `deps.githubClient.request` is typed — adjust imports accordingly.

**Step 5: Update `executeTask` to be a thin wrapper (optional for now)**

Leave `executeTask` as-is for this task. The design says it eventually wraps `executeTasks`, but since `executeTasks` delegates 1-item to `executeTask`'s existing path, this would be circular. Keep both functions independent for now — `executeTasks(1 item)` calls `executeTask` internally.

**Step 6: Run tests**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/engine.test.ts
```
Fix any type errors or logic bugs. Aim for all tests passing.

**Step 7: Typecheck and commit**

```bash
pnpm run typecheck
git add packages/core/src/core/routing/engine.ts packages/core/test/unit/engine.test.ts
git commit -m "feat(core): implement executeTasks with two-phase batch execution"
```

---

## Task 8: Add `ghx chain` CLI subcommand

**Files:**
- Create: `packages/core/src/cli/commands/chain.ts`
- Modify: `packages/core/src/cli/index.ts`
- Test: `packages/core/test/unit/chain-command.test.ts`

**Step 1: Read `cli/commands/run.ts` before writing `chain.ts`**

Read `packages/core/src/cli/commands/run.ts` fully to understand patterns: flag parsing, stdin reading, token resolution, error handling, JSON output. Mirror these patterns.

**Step 2: Write failing test**

```ts
import { describe, expect, it, vi } from "vitest"
// Test that chain command parses --steps JSON and calls executeTasks
// Mock executeTasks to verify it's called with parsed requests
```

**Step 3: Implement `cli/commands/chain.ts`**

```ts
import { executeTasks } from "../../core/routing/engine.js"
// Parse --steps flag (JSON array or stdin "-")
// Validate parsed value is array of { task, input }
// Build ExecutionDeps from token
// Call executeTasks, print JSON.stringify(result, null, 2)
// Exit 0 on success/partial, non-zero on full failure
```

Key ergonomics:
- `--steps '<json>'` — inline JSON
- `--steps -` — read from stdin (same as `--input -` in run command)
- Exit code: 0 for `success`/`partial`, 1 for `failed`

**Step 4: Add dispatch in `cli/index.ts`**

```ts
case "chain":
  await runChainCommand(args.slice(1))
  break
```

**Step 5: Run tests, typecheck, commit**

```bash
pnpm --filter @ghx-dev/core exec vitest run test/unit/chain-command.test.ts
pnpm run typecheck
git add packages/core/src/cli/commands/chain.ts packages/core/src/cli/index.ts packages/core/test/unit/chain-command.test.ts
git commit -m "feat(cli): add ghx chain --steps subcommand"
```

---

## Task 9: Delete composite system

**Files:**
- Delete: `packages/core/src/core/execute/composite.ts`
- Delete: `packages/core/src/core/registry/cards/pr.threads.composite.yaml`
- Delete: `packages/core/src/core/registry/cards/issue.triage.composite.yaml`
- Delete: `packages/core/src/core/registry/cards/issue.update.composite.yaml`
- Modify: `packages/core/src/core/registry/types.ts` — remove `CompositeConfig`, `CompositeStep`, `composite?` field
- Modify: `packages/core/src/core/registry/operation-card-schema.ts` — remove `composite` property
- Modify: `packages/core/src/core/registry/index.ts` — remove composite IDs from `preferredOrder`
- Modify: `packages/core/src/core/routing/engine.ts` — remove `executeComposite`

**Step 1: Read all files being changed before touching them**

Especially `engine.ts` (find all references to `executeComposite`/`composite`) and `registry/index.ts` (find composite IDs in `preferredOrder`).

**Step 2: Delete the three composite YAML cards**

```bash
git rm packages/core/src/core/registry/cards/pr.threads.composite.yaml
git rm packages/core/src/core/registry/cards/issue.triage.composite.yaml
git rm packages/core/src/core/registry/cards/issue.update.composite.yaml
```

**Step 3: Delete `composite.ts`**

```bash
git rm packages/core/src/core/execute/composite.ts
```

**Step 4: Remove composite from `types.ts`**

Remove `CompositeStep` interface, `CompositeConfig` interface, and `composite?` from `OperationCard`.

**Step 5: Remove `composite` from `operation-card-schema.ts`**

Delete the `composite:` property block.

**Step 6: Remove composite IDs from `registry/index.ts`**

Find the `preferredOrder` array and remove `pr.threads.composite`, `issue.triage.composite`, `issue.update.composite` entries.

**Step 7: Remove `executeComposite` from `engine.ts`**

Find and delete the `executeComposite` function and any code that references it in the routing logic.

**Step 8: Run all tests**

```bash
pnpm --filter @ghx-dev/core exec vitest run
```
Fix any broken imports or references. The composite system should leave no traces.

**Step 9: Typecheck and commit**

```bash
pnpm run typecheck
git add -A
git commit -m "refactor(core): delete composite capability system (never published)"
```

---

## Task 10: Export new public API from `index.ts`

**Files:**
- Modify: `packages/core/src/index.ts`
- Test: verify exports compile

**Step 1: Read `index.ts`**

Understand what's currently exported.

**Step 2: Add new exports**

```ts
export { executeTasks } from "./core/routing/engine.js"
export type { ChainResultEnvelope, ChainStepResult, ChainStatus } from "./core/contracts/envelope.js"
```

**Step 3: Typecheck and run full test suite**

```bash
pnpm run typecheck
pnpm --filter @ghx-dev/core exec vitest run
```

**Step 4: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export executeTasks and chain types from public API"
```

---

## Task 11: Add changeset + clean up

**Files:**
- Delete: `.changeset/composite-capabilities-gql-integration.md` (if exists)
- Create: `.changeset/<kebab-name>.md`

**Step 1: Check for old changeset**

```bash
ls .changeset/
```

If `composite-capabilities-gql-integration.md` exists, delete it:
```bash
git rm .changeset/composite-capabilities-gql-integration.md
```

**Step 2: Create new changeset**

```bash
cat > .changeset/atomic-capability-chaining.md << 'EOF'
---
"@ghx-dev/core": minor
---

Add `executeTasks` for atomic capability chaining. Callers can now execute multiple capabilities in a single tool call with at most 2 GitHub API round-trips via two-phase batch execution (Phase 1: resolution queries, Phase 2: mutations). Resolution requirements are declared in YAML operation cards via `graphql.resolution`. Removes unused composite capability cards.
EOF
```

**Step 3: Final CI check**

```bash
pnpm run ci --outputStyle=static
```

Fix any remaining lint, format, typecheck, or test failures.

**Step 4: Final commit**

```bash
git add .changeset/
git commit -m "chore: add minor changeset for executeTasks"
```

---

## Done

All tasks complete when `pnpm run ci --outputStyle=static` passes with no errors. The implementation delivers:
- `executeTasks` API (≤ 2 HTTP calls for any chain)
- Card-defined resolution in 6 capability cards
- `ghx chain --steps` CLI
- Composite system removed
- `ChainResultEnvelope` exported from public API

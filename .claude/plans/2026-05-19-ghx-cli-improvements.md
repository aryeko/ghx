# ghx CLI Improvements — Implementation Plan

**Goal:** Land the 8 issues documented in `.claude/analysis/ghx-cli-improvements.md` as a single consolidated PR, following the analysis order A → C → B → D → E (foundations → new capabilities → polish → docs).

**Architecture:** All changes live under `packages/core/`. New GraphQL ops require codegen (`pnpm run ghx:gql:verify`). Generated files under `gql/operations/*.generated.ts` and `gql/generated/**` are off-limits to hand edits.

**Tech Stack:** TypeScript strict, Vitest (TDD), AJV input validation, YAML cards, GraphQL via codegen.

---

## Open assumptions

1. **Single consolidated PR.** Matches the user's `CLAUDE.md` preference. All 8 issues bundled, ordered foundations → features → docs in commits.
2. **Issue #5 enum casing — accept both, not break callers.** Per analysis: "Either gate behind a `compatibility: accept_uppercase` flag, or version-bump." I'll widen the YAML enum to accept both lowercase and uppercase, and normalize to the expected GitHub case in the handler. No breakage for either caller convention. Changeset: `minor`.
3. **Issue #4 chain support — focus on `pr.merge` only.** The analysis explicitly names `pr.merge`. Other mutations (`pr.update`, `pr.branch.update`, `pr.assignees.*`, `issue.update`, etc.) likely have the same bug but are out of scope here. I'll add a `resolution:` block to `pr.merge.yaml` and a small `input_upper` inject source so `method` → `mergeMethod` (uppercased) works declaratively.
4. **Issue #2 `pr.close` — support `deleteBranch?` and `comment?`.** `deleteBranch` routes to the CLI because GitHub's `closePullRequest` mutation cannot delete refs. `comment` is supported through `gh pr close --comment` on the CLI path and a conditional `addComment` field in the GraphQL `PrClose` document.
5. **Issue #7 — only `pr.view`, not the four read-heavy capabilities.** The analysis lists `pr.view, issue.view, pr.list, issue.list` but says "lower-effort alternative: add an `exclude?: ["body"]` flag." I'll do the lower-effort alternative on `pr.view` only and document that the same pattern can be extended later.

---

## Sequencing & file map (in commit order)

### Commit 1 — Issue #5a: AJV error message enrichment

**Files:**
- Modify: `packages/core/src/core/registry/engine/preflight.ts:38-42` (chain path)
- Modify: `packages/core/src/core/execute/execute.ts:120-135` (single-call path) — but the single-call path uses `normalizeError` with `ajvErrors` raw, so enrichment must live at error-formatter site. Inspect first; if enrichment only matters for the chain path's stringified error, only touch `preflight.ts`.
- Add test: `packages/core/test/unit/preflight-error-messages.test.ts`

**Behavior:** When AJV error has `keyword: "enum"` and `params.allowedValues` is an array, append `(allowed: <comma-joined values>)` to the message. When keyword is `"type"`, append `(expected: <params.type>)`.

### Commit 2 — Issue #5b: Case-insensitive enum cards

**Files:**
- Modify: `packages/core/src/core/registry/cards/pr.merge.yaml` — input.method.enum from `[merge, squash, rebase]` to `[merge, squash, rebase, MERGE, SQUASH, REBASE]`. Output schema unchanged (lowercase).
- Modify: `packages/core/src/core/registry/cards/pr.reviews.submit.yaml` — input.event.enum from `[APPROVE, COMMENT, REQUEST_CHANGES]` to `[APPROVE, COMMENT, REQUEST_CHANGES, approve, comment, request_changes]`. Also widen `comments[].side` and `comments[].startSide` to accept both `LEFT/RIGHT/left/right`.
- Modify: `packages/core/src/gql/domains/pr-mutations.ts:344-349` — uppercase `input.event` and `comment.side`/`comment.startSide` before passing to SDK.
- The `pr.merge` GraphQL handler in `capability-registry.ts:362-370` already lowercases then uppercases via `methodMap`. Confirm it still works.
- Add tests: `packages/core/test/unit/cards/pr-merge-card.test.ts`, `packages/core/test/unit/cards/pr-reviews-submit-card.test.ts` — call `validateInput` with both cases.

### Commit 3 — Issue #6: integer coercion

**Files:**
- Modify: `packages/core/src/core/registry/ajv-instance.ts` — change AJV options to `{ allErrors: true, strict: false, coerceTypes: true }`.
- Add test: `packages/core/test/unit/ajv-coercion.test.ts` verifying string `"42"` coerces to integer; non-numeric `"abc"` still fails with enriched error.

**Risk note:** `coerceTypes: true` also coerces booleans (`"true"` → `true`), arrays, etc. Confirm no card relies on strict-string-not-coercing behavior. Verify against full test suite.

### Commit 4 — Issue #3: pr.merge --admin and --auto

**Files:**
- Modify: `packages/core/src/core/registry/cards/pr.merge.yaml`:
  - Add `admin: { type: boolean, description: "..." }` and `auto: { type: boolean, description: "..." }` to input properties.
  - Add mutual-exclusion guard:
    ```yaml
    not:
      type: object
      properties:
        admin: { const: true }
        auto: { const: true }
      required: [admin, auto]
    ```
  - Add `routing.suitability` to route to CLI when either is true:
    ```yaml
    routing:
      preferred: graphql
      fallbacks: [cli]
      suitability:
        - when: params
          predicate: cli if admin == true
          reason: "gh CLI required for --admin"
        - when: params
          predicate: cli if auto == true
          reason: "gh CLI required for --auto"
    ```
  - Add `admin`/`auto` to output_schema as optional booleans (purely informational).
- Modify: `packages/core/src/core/execution/adapters/cli/domains/pr.ts:506-562`:
  - Validate `admin`/`auto` are boolean.
  - After `--{method}`, push `--admin` if admin, `--auto` if auto.
  - Echo admin/auto in normalized output.
- Add tests: `packages/core/test/unit/cards/pr-merge-admin-auto.test.ts`:
  - Input with admin:true validates; routes to CLI; CLI handler emits `--admin`.
  - Input with auto:true validates; routes to CLI; CLI handler emits `--auto`.
  - Input with admin:true AND auto:true → validation fails.

### Commit 5 — Issue #4: chain pr.merge resolution

**Files:**
- Modify: `packages/core/src/core/registry/operation-card-schema.ts` — add `input_upper` to the `inject[]` oneOf:
  ```ts
  {
    type: "object",
    required: ["target", "source", "from_input"],
    properties: {
      target: { type: "string", minLength: 1 },
      source: { const: "input_upper" },
      from_input: { type: "string", minLength: 1 },
    },
    additionalProperties: false,
  },
  ```
- Modify: `packages/core/src/core/registry/types.ts` — add the new variant to `InjectSpec`.
- Modify: `packages/core/src/gql/resolve.ts:14-39` — extend `applyInject`:
  - For `source: "input_upper"`: if input field missing → return `{}` (skip; the target stays undefined so the optional GQL variable is omitted). If present but not a string, throw. Otherwise, uppercase and return.
- Modify: `packages/core/src/core/routing/engine/preflight.ts:51-60` — the current check requires every lookup var to exist on input. `input_upper` is **not** a lookup var (it's an inject spec, not a lookup arg), so this check shouldn't fire on it. Skim and confirm no false trigger.
- Modify: `packages/core/src/core/registry/cards/pr.merge.yaml` — add `graphql.resolution`:
  ```yaml
  resolution:
    lookup:
      operationName: PrNodeId
      documentPath: src/gql/operations/pr-node-id.graphql
      vars:
        owner: owner
        name: name
        prNumber: prNumber
    inject:
      - target: pullRequestId
        source: scalar
        path: repository.pullRequest.id
      - target: mergeMethod
        source: input_upper
        from_input: method
  ```
- Modify: `packages/core/src/core/routing/engine/execute.ts:46-50` — `applyInject` is called inside the loop, and `input_upper` with no source value should not throw. Confirm `Object.assign(resolved, {})` is a no-op.
- Add test: `packages/core/test/unit/chain-pr-merge.test.ts`:
  - 2-step `pr.merge` chain against a mock client. First mock returns `step0.pullRequest.id` and `step1.pullRequest.id`. Second mock confirms the batched mutation variables include `step0_pullRequestId`, `step0_mergeMethod=SQUASH`, `step1_pullRequestId`, `step1_mergeMethod=SQUASH`. Result is `success`.
  - 2-step `pr.merge` chain with no `method` — variables omit `mergeMethod`. Result is `success`.

### Commit 6 — Issue #1: pr.comments.create

**Files:**
- Add: `packages/core/src/core/registry/cards/pr.comments.create.yaml`. Identical structure to `issue.comments.create.yaml` except uses `PrNodeId` lookup and reads `prNumber`. Inject `issueId` (the existing `addComment` mutation parameter accepts both Issue and PullRequest subject IDs):
  ```yaml
  capability_id: pr.comments.create
  ...
  graphql:
    operationName: IssueCommentCreate
    operationType: mutation
    documentPath: src/gql/operations/issue-comment-create.graphql
    resolution:
      lookup:
        operationName: PrNodeId
        documentPath: src/gql/operations/pr-node-id.graphql
        vars: { owner: owner, name: name, prNumber: prNumber }
      inject:
        - target: issueId
          source: scalar
          path: repository.pullRequest.id
  ```
- Modify: `packages/core/src/gql/capability-registry.ts` — register `pr.comments.create` reusing the same handler as `issue.comments.create` (input shape differs by `issueNumber` vs `prNumber`, but the resolution layer takes care of node ID lookup; the handler just calls `createIssueComment` with `{issueId, body}`).
  - Need to check: does the handler take raw `{owner, name, issueNumber, body}` or the post-resolution input? Inspect `createIssueComment` in `issue-mutations.ts`.
- Modify: `packages/core/src/core/registry/index.ts:19-90` — add `pr.comments.create` to `preferredOrder` near `pr.create`.
- Add test: `packages/core/test/unit/cards/pr-comments-create.test.ts` — validates input schema; mocked single-call returns expected data.

### Commit 7 — Issue #2: pr.close

**Files:**
- Add: `packages/core/src/gql/operations/pr-close.graphql`:
  ```graphql
  mutation PrClose($pullRequestId: ID!) {
    closePullRequest(input: { pullRequestId: $pullRequestId }) {
      pullRequest {
        id
        number
        state
        closed
      }
    }
  }
  ```
- Run `pnpm run ghx:gql:verify` (or codegen script) to generate `pr-close.generated.ts`.
- Register in `packages/core/src/gql/document-registry.ts`.
- Add SDK invocation function `closePr` in `packages/core/src/gql/domains/pr-mutations.ts` mirroring `runPrMerge`'s structure.
- Wire into `packages/core/src/gql/github-client.ts` and `packages/core/src/gql/types.ts` (add `PrCloseInput`, `PrCloseData`, `closePr?: ...`).
- Add: `packages/core/src/core/registry/cards/pr.close.yaml` with PrNodeId lookup. Inputs `{owner, name, prNumber, deleteBranch?}`. Routing.suitability: route to CLI when deleteBranch:true.
- Add CLI handler in `packages/core/src/core/execution/adapters/cli/domains/pr.ts` (`handlePrClose`).
- Add to `CliCapabilityId` union in `cli-capability-adapter.ts`.
- Register in `cli/capability-registry.ts`.
- Register in `gql/capability-registry.ts`.
- Modify `packages/core/src/core/registry/index.ts:19-90` — add `pr.close` to `preferredOrder` near `pr.merge`.
- Add tests: `packages/core/test/unit/cards/pr-close.test.ts` (GraphQL path), `packages/core/test/unit/cli-domains-pr.test.ts` (CLI path for deleteBranch).

### Commit 8 — Issue #7: pr.view exclude option

**Files:**
- Modify: `packages/core/src/core/registry/cards/pr.view.yaml` — add `exclude: { type: array, items: { type: string, enum: [body] } }` to input properties. Loosen output_schema to make `body` not required:
  - Move `body` out of `required`, but keep it in `properties` (still emitted by default).
- Modify the GraphQL handler for `pr.view` (`fetchPrView` in `packages/core/src/gql/domains/pr-queries.ts`) to omit `body` when the input's `exclude` contains `"body"`. Actually `runGraphqlCapability` already validates output via the card's schema, so if we make body optional, the handler can drop it.
- Better path: post-hoc strip in `runGraphqlCapability`? No — handler is per-capability. Strip inside `fetchPrView` (cleaner: only that capability changes).
- Add test: `packages/core/test/unit/cards/pr-view-exclude.test.ts`.

### Commit 9 — Issue #8: SKILL.md refresh

**Files:**
- Modify: `packages/core/skills/using-ghx/SKILL.md`:
  - Add `pr.comments.create` and `pr.close` to the capability list.
  - Update `pr.merge` line to include `admin?` and `auto?`.
  - Update `pr.view` line to include `exclude?`.
  - Replace the "When NOT to chain" section's blanket claim with: "Mutation chaining works for `pr.merge` and `issue.close`/`issue.comments.create`/etc. Sequential is still required when a later step depends on an earlier step's output."
  - Add a "Common errors" troubleshooting block: case-insensitive enums; integer coercion; `--admin`/`--auto` for protected branches.

### Commit 10 — Changeset

**Files:**
- Add: `.changeset/ghx-cli-improvements.md`:
  ```yaml
  ---
  "@ghx-dev/core": minor
  ---

  Add pr.comments.create and pr.close capabilities; add `admin`/`auto` to pr.merge;
  enable mutation chaining for pr.merge; add `exclude` option to pr.view;
  improve AJV error messages (allowed enum values, expected type);
  accept both lowercase and uppercase enum values; coerce string-form integers.
  See .claude/analysis/ghx-cli-improvements.md for the source analysis.
  ```

---

## Verification gate (before pushing)

```bash
pnpm run ci --outputStyle=static
pnpm run ghx:gql:verify
```

Both must pass with zero warnings.

## Coverage

≥90% on touched files. Aim for 95%. Spot-check via:
```bash
pnpm --filter @ghx-dev/core run test:coverage
```

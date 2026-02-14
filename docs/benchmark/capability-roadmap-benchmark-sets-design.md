# Benchmark Design: Scenario Sets for Roadmap Batches A-D

**Status:** Planned  
**Date:** 2026-02-14  
**Depends on:** `docs/architecture/capability-roadmap-adoption-design.md`

---

## 1) Motivation

The roadmap introduces a broad set of new capabilities across PR execution, issue lifecycle, release workflows, workflow controls, and Projects v2 operations.

Without explicit scenario-set planning, benchmark behavior risks three failures:

1. default baseline drift as new scenarios are added,
2. accidental inclusion of mutating scenarios in default runs,
3. inability to evaluate batch-level progress and regressions independently.

We need benchmark sets that map exactly to roadmap batches while preserving historical comparability.

---

## 2) Goals

1. Define benchmark scenario sets for each roadmap batch (A-D).
2. Keep default benchmark behavior stable and mutation-free.
3. Provide complete capability-to-scenario mapping for new operations.
4. Ensure scenario selection is deterministic and validated in CI.
5. Define explicit validation requirements and acceptance gates per batch.

## 3) Non-goals

- Redesign benchmark scoring or report gate formulas.
- Auto-resetting all external fixture state for mutating scenarios.
- Merging all roadmap scenarios into the default set.

---

## 4) Scenario Set Model

Set definitions are maintained in `packages/benchmark/scenario-sets.json`.

### 4.1 Required sets

- `default` (unchanged baseline)
- `roadmap-batch-a-pr-exec`
- `roadmap-batch-b-issues`
- `roadmap-batch-c-release-delivery`
- `roadmap-batch-d-workflow-projects-v2`
- `roadmap-all` (union of all roadmap batch sets)

### 4.2 Selection precedence

1. `--scenario <id>`
2. `--scenario-set <name>`
3. implicit `default`

---

## 5) Batch-Level Scenario Design

Scenario IDs below define the intended coverage shape. Exact fixture repo/PR/issue identifiers are environment-specific and remain externalized.

### 5.1 Batch A set (`roadmap-batch-a-pr-exec`)

Coverage targets:

- `pr.review.submit_approve`
- `pr.review.submit_request_changes`
- `pr.review.submit_comment`
- `pr.merge.execute`
- `pr.checks.rerun_failed`
- `pr.checks.rerun_all`
- `pr.reviewers.request`
- `pr.assignees.update`
- `pr.branch.update`

Representative scenario IDs:

- `batch-a-pr-review-submit-approve-001`
- `batch-a-pr-review-submit-request-changes-001`
- `batch-a-pr-review-submit-comment-001`
- `batch-a-pr-merge-execute-001`
- `batch-a-pr-checks-rerun-failed-001`
- `batch-a-pr-checks-rerun-all-001`
- `batch-a-pr-reviewers-request-001`
- `batch-a-pr-assignees-update-001`
- `batch-a-pr-branch-update-001`

Assertions:

- envelope success shape and capability id match,
- expected state transition markers (for example merge status changed),
- route and reason metadata present.

### 5.2 Batch B set (`roadmap-batch-b-issues`)

Coverage targets (all `issue.*` in roadmap):

- lifecycle: create/update/close/reopen/delete,
- assignment and labeling,
- milestone assignment,
- comment creation,
- linked PR reads,
- dependency relation reads/mutations.

Representative scenario IDs:

- `batch-b-issue-create-001`
- `batch-b-issue-update-001`
- `batch-b-issue-close-001`
- `batch-b-issue-reopen-001`
- `batch-b-issue-delete-001`
- `batch-b-issue-labels-update-001`
- `batch-b-issue-assignees-update-001`
- `batch-b-issue-milestone-set-001`
- `batch-b-issue-comments-create-001`
- `batch-b-issue-linked-prs-list-001`
- `batch-b-issue-relations-get-001`
- `batch-b-issue-parent-set-001`
- `batch-b-issue-parent-remove-001`
- `batch-b-issue-blocked-by-add-001`
- `batch-b-issue-blocked-by-remove-001`

Assertions:

- dependency graph fields are present and well-shaped,
- mutation scenarios verify changed state via follow-up read checks,
- expected canonical errors for unsupported mutations are mapped.

### 5.3 Batch C set (`roadmap-batch-c-release-delivery`)

Coverage targets:

- `release.list`
- `release.get`
- `release.create_draft`
- `release.update`
- `release.publish_draft`
- `workflow_dispatch.run`
- `workflow_run.rerun_failed`

Representative scenario IDs:

- `batch-c-release-list-001`
- `batch-c-release-get-001`
- `batch-c-release-create-draft-001`
- `batch-c-release-update-001`
- `batch-c-release-publish-draft-001`
- `batch-c-workflow-dispatch-run-001`
- `batch-c-workflow-run-rerun-failed-001`

Assertions:

- draft-first lifecycle is enforced,
- publish scenario validates transition from draft to published,
- workflow dispatch/rerun returns run identifiers and queued/executing status fields.

### 5.4 Batch D set (`roadmap-batch-d-workflow-projects-v2`)

Coverage targets:

- workflow inspection/control operations,
- Projects v2 operations only,
- repo metadata operations (`repo.labels.list`, `repo.issue_types.list`).

Representative scenario IDs:

- `batch-d-workflow-list-001`
- `batch-d-workflow-get-001`
- `batch-d-workflow-run-get-001`
- `batch-d-workflow-run-rerun-all-001`
- `batch-d-workflow-run-cancel-001`
- `batch-d-workflow-run-artifacts-list-001`
- `batch-d-project-v2-org-get-001`
- `batch-d-project-v2-user-get-001`
- `batch-d-project-v2-fields-list-001`
- `batch-d-project-v2-items-list-001`
- `batch-d-project-v2-item-add-issue-001`
- `batch-d-project-v2-item-field-update-001`
- `batch-d-repo-labels-list-001`
- `batch-d-repo-issue-types-list-001`

Assertions:

- project responses are explicitly v2-shaped,
- no classic project fields appear in normalized output,
- list operations provide bounded pagination info.

---

## 6) Requirements

### 6.1 Functional requirements

1. Each new capability in roadmap batches A-D maps to at least one scenario in its batch set.
2. `roadmap-all` is an exact union of batch sets (A-D).
3. `default` does not include roadmap mutation scenarios.
4. Scenario-set resolution remains deterministic.
5. Scenario errors for unknown set names are explicit and actionable.

### 6.2 Quality requirements

1. Scenario IDs are unique and follow `batch-<letter>-<capability>-<nnn>` naming.
2. Each mutation scenario includes at least one follow-up assertion source (direct response or follow-up read).
3. Set files are validated by `check:scenarios` for missing refs/orphans/duplicates.
4. Benchmark rows include `scenario_set` metadata for set-driven runs.

### 6.3 Safety requirements

1. Mutating scenarios are isolated to non-default sets.
2. Fixture repos/issues/PRs are dedicated and resettable where feasible.
3. No sensitive credentials in scenario files or benchmark artifacts.
4. Potentially destructive operations (for example delete) require dedicated test fixtures and explicit warnings in scenario docs.

---

## 7) Validation Plan

### 7.1 Unit validation

- scenario set loader/resolver tests for all new set names,
- precedence tests for `--scenario` over `--scenario-set`,
- schema validation tests for scenario IDs and set membership.

### 7.2 Integration validation

- benchmark CLI passes scenario-set options to runner,
- runner persists `scenario_set` metadata correctly,
- each batch set executes only scenarios in that set.

### 7.3 Batch completeness validation

Add a static check that compares:

- capability inventory from roadmap batches,
- scenario IDs referenced in corresponding batch sets.

The check fails when a capability is missing benchmark coverage.

### 7.4 Gate commands

```bash
pnpm --filter @ghx/benchmark run check:scenarios
pnpm --filter @ghx/benchmark run test
pnpm --filter @ghx/benchmark run typecheck
pnpm --filter @ghx/benchmark run lint
```

Optional batch run commands:

```bash
pnpm --filter @ghx/benchmark run run -- ghx_router 1 --scenario-set roadmap-batch-a-pr-exec
pnpm --filter @ghx/benchmark run run -- ghx_router 1 --scenario-set roadmap-batch-b-issues
pnpm --filter @ghx/benchmark run run -- ghx_router 1 --scenario-set roadmap-batch-c-release-delivery
pnpm --filter @ghx/benchmark run run -- ghx_router 1 --scenario-set roadmap-batch-d-workflow-projects-v2
```

---

## 8) Rollout

1. Add batch set definitions to `scenario-sets.json`.
2. Add skeleton scenarios for each new capability with placeholder fixtures.
3. Enable batch-level validation checks in `check:scenarios`.
4. Populate stable fixture targets and tighten assertions.
5. Keep CI default gate on `default`; use roadmap sets for staged expansion and readiness checks.

---

## 9) Acceptance Criteria

1. Scenario sets for batches A-D exist and validate.
2. Every roadmap capability has at least one mapped scenario in its batch set.
3. `roadmap-all` equals the union of A-D sets.
4. Default set remains stable and mutation-free.
5. Batch runs produce benchmark rows with set metadata and pass benchmark checks.

# Issue Domain Eval Workflows

**Date:** 2026-03-14
**Status:** Draft
**Scope:** 3 new eval scenarios covering the issue domain with multi-step capability chaining

## Context

ghx currently has 2 PR-only eval scenarios (`pr-review-comment-001`, `pr-reply-threads-wf-001`) covering 6 of 70 capabilities. The issue domain (23 capabilities) has zero coverage. ghx's value proposition is strongest in multi-step workflows where structured routing reduces tool calls and token usage compared to raw `gh` CLI or MCP tools.

This spec adds 3 intermediate-to-advanced issue-domain scenarios that chain 5-6 capabilities each, expanding eval coverage to a second domain and testing cross-domain (issue + PR) coordination.

**Deferred:** A workflow/CI debugging scenario (`workflow-debug-and-rerun-wf-001`) is deferred due to fixture complexity — it requires a GitHub Actions workflow that reliably fails within the fixture setup window.

## Scenarios

### 1. `issue-triage-and-assign-wf-001` (intermediate)

**Purpose:** Agent triages a newly filed issue by reading it, inspecting available labels, applying labels, assigning a user, setting a milestone, and posting a triage summary.

**Prompt:**
```
Issue #{{issue_number}} in {{repo}} has just been filed. Triage it: read the issue,
check the repo's available labels, apply the most relevant labels, assign it to user
'{{assignee}}', set milestone #{{milestone_number}}, and post a triage summary comment
explaining the priority and next steps.
```

**Capability chain:** `issue.view` -> `repo.labels.list` -> `issue.labels.set` -> `issue.assignees.add` -> `issue.milestone.set` -> `issue.comments.create`

**Fixture:** `issue_for_triage`
- Type: `issue`
- Open issue with descriptive body (bug report style), no labels, no assignees, no milestone
- Seeder applies zero labels (no tracking label — this fixture must start clean for the `labels-applied` checkpoint)
- `seedPerIteration: true`
- Bindings: `issue_number`, `repo`, `owner`, `repo_name`
- Extra bindings from fixture repo config: `assignee`, `milestone_number`

**Checkpoints:**

| ID | Task | Input | Condition | Description |
|---|---|---|---|---|
| `labels-applied` | `issue.view` | `owner`, `name`, `issueNumber` | `field_gte` path=`labels.length` value=1 | At least one label applied (fixture starts with zero) |
| `milestone-set` | `issue.view` | `owner`, `name`, `issueNumber` | `field_equals` path=`milestone.number` value=`{{milestone_number}}` | Correct milestone assigned |
| `triage-comment-exists` | `issue.comments.list` | `owner`, `name`, `issueNumber`, `first: 10` | `field_gte` path=`items.length` value=1 | Triage summary comment posted |

**Note:** Assignee verification is not included because `issue.view` output does not currently include an `assignees` field. The agent is still instructed to assign, and `issue.assignees.add` is in the expected capabilities, but verification is deferred until the card is extended.

**Expected capabilities:** `issue.view`, `repo.labels.list`, `issue.labels.set`, `issue.assignees.add`, `issue.milestone.set`, `issue.comments.create`

**Timeout:** 120000ms | **Retries:** 1

**Tags:** `["issue", "triage", "labels", "assign", "milestone", "api-only"]`

---

### 2. `issue-close-with-context-wf-001` (intermediate)

**Purpose:** Agent searches for a specific bug issue, posts a resolution comment, updates labels from `bug` to `resolved`, and closes the issue.

**Prompt:**
```
In {{repo}}, find open issues with the label 'bug'. View each one and find the issue
whose title contains '{{search_term}}'. Post a resolution comment explaining the fix,
replace the 'bug' label with 'resolved', and close the issue.
```

**Capability chain:** `issue.list` -> `issue.view` -> `issue.comments.create` -> `issue.labels.set` -> `issue.close`

**Fixture:** `issue_bug_to_close`
- Type: `issue`
- Open issue with only the `bug` label (no `@ghx-dev/eval` tracking label — keeps label count predictable)
- Distinctive title containing the search term
- `seedPerIteration: true`
- Bindings: `issue_number`, `repo`, `owner`, `repo_name`, `search_term`

**Checkpoints:**

| ID | Task | Input | Condition | Description |
|---|---|---|---|---|
| `issue-closed` | `issue.view` | `owner`, `name`, `issueNumber` | `field_equals` path=`state` value=`"CLOSED"` | Issue is closed |
| `resolution-comment` | `issue.comments.list` | `owner`, `name`, `issueNumber`, `first: 10` | `field_gte` path=`items.length` value=1 | Resolution comment posted |
| `bug-label-removed` | `issue.view` | `owner`, `name`, `issueNumber` | `field_equals` path=`labels.length` value=1 | Exactly one label remains (bug removed, resolved added) |
| `resolved-label-applied` | `issue.view` | `owner`, `name`, `issueNumber` | `field_equals` path=`labels.0` value=`"resolved"` | The remaining label is "resolved" |

**Note:** Labels in `issue.view` output are an array of strings (not objects), so paths reference the string directly (e.g., `labels.0`, not `labels.0.name`).

**Expected capabilities:** `issue.list`, `issue.view`, `issue.comments.create`, `issue.labels.set`, `issue.close`

**Timeout:** 120000ms | **Retries:** 1

**Tags:** `["issue", "close", "labels", "search", "api-only"]`

---

### 3. `issue-to-pr-lifecycle-wf-001` (advanced, cross-domain)

**Purpose:** Agent reads an issue, creates a PR referencing it, and submits a review requesting changes. Tests cross-domain coordination between issue and PR subsystems.

**Prompt:**
```
Issue #{{issue_number}} in {{repo}} describes a needed change. Create a PR from branch
'{{head_branch}}' to '{{base_branch}}' that references this issue (include
'Fixes #{{issue_number}}' in the body). Then submit a review on the PR requesting
changes with at least one specific suggestion.
```

**Capability chain:** `issue.view` -> `pr.create` -> `pr.reviews.submit`

**Fixture:** `issue_with_branch`
- Type: composite (`issue` + branch)
- Creates an open issue AND pushes a feature branch with a small commit diff
- `seedPerIteration: true`
- Bindings: `issue_number`, `repo`, `owner`, `repo_name`, `head_branch`, `base_branch`
- Manifest metadata: `headBranch`, `baseBranch`

**Checkpoints:**

| ID | Task | Input | Condition | Description |
|---|---|---|---|---|
| `pr-created-for-issue` | `issue.relations.prs.list` | `owner`, `name`, `issueNumber` | `field_gte` path=`items.length` value=1 | A PR linked to the issue exists |

**v1 simplification:** Only the PR-linkage checkpoint is included. The `pr.reviews.list` checkpoint requires the dynamically created PR number, which needs checkpoint output forwarding (see Open Questions). For v1, we verify the cross-domain chain completed (issue -> PR created) without verifying the review. The review capability is still in `expectedCapabilities` for behavioral analysis.

**Expected capabilities:** `issue.view`, `pr.create`, `pr.reviews.submit`

**Timeout:** 180000ms | **Retries:** 1 (higher timeout for cross-domain multi-step)

**Tags:** `["issue", "pr", "cross-domain", "lifecycle", "api-only"]`

---

## Fixture Infrastructure

### New Seeders

#### `createTriageIssueSeeder()`

Creates an open issue with a descriptive body suitable for triage decisions. Zero labels, no assignees, no milestone. The `[@ghx-dev/eval]` prefix in the title is used for cleanup identification but no label is applied.

```
Title: "[@ghx-dev/eval] Performance degradation in API response times"
Body: Multi-paragraph bug report with reproduction steps, expected vs actual behavior
Labels: [] (none — checkpoint asserts labels.length >= 1 after agent acts)
```

Extends the existing `createIssueSeeder()` pattern but passes an empty labels array. Returns `FixtureResource` with `type: "issue"`.

#### `createBugIssueSeeder()`

Creates an open issue with only the `bug` label and a title containing a known search term. No tracking label — the scenario asserts exactly 1 label remains after the swap.

```
Title: "[@ghx-dev/eval] Memory leak in connection pooling"
Body: Bug report body
Labels: ["bug"] (only bug — no tracking label)
Search term stored in metadata: "Memory leak in connection pooling"
```

Reuses the existing `createIssueSeeder()` with a single `bug` label. Returns `FixtureResource` with `type: "issue"` and `metadata: { searchTerm: "..." }`.

#### `createIssueBranchSeeder()`

Composite seeder that creates both an issue and a feature branch.

```
1. Create issue via `gh issue create`
2. Create branch from main: `git checkout -b eval-fix-{{seed_id}}`
3. Add a small file change (e.g., `eval-fixture.txt`)
4. Push branch to fixture repo
5. Return FixtureResource with type: "issue_branch",
   metadata: { headBranch, baseBranch: "main" }
```

This seeder is new — no existing seeder handles composite issue+branch resources.

### Fixture Repo Prerequisites

The fixture repo (`aryeko/ghx-bench-fixtures`) must have:

1. **A milestone** — at least one open milestone for the triage scenario to reference. Can be created once manually or via a one-time setup script.
2. **The `resolved` label** — must exist in the repo for the close-with-context scenario. Created once manually.
3. **The `bug` label** — must exist (likely already does as a GitHub default).

### Reset Strategy

All 3 scenarios use `seedPerIteration: true`. Each iteration gets a fresh issue (and branch, for scenario 3) to avoid state leakage between modes. The seeder creates, the hooks clean up after each iteration.

## Scenario Sets

```json
{
  "default": ["pr-reply-threads-wf-001"],
  "pr-only": ["pr-reply-threads-wf-001", "pr-review-comment-001"],
  "issue-only": [
    "issue-triage-and-assign-wf-001",
    "issue-close-with-context-wf-001",
    "issue-to-pr-lifecycle-wf-001"
  ],
  "full": [
    "pr-reply-threads-wf-001",
    "pr-review-comment-001",
    "issue-triage-and-assign-wf-001",
    "issue-close-with-context-wf-001",
    "issue-to-pr-lifecycle-wf-001"
  ]
}
```

## Open Questions

1. **Checkpoint chaining for scenario 3:** The `pr.reviews.list` checkpoint needs the PR number, but the PR is created dynamically by the agent. Options:
   - (a) Add a `field_equals` check on `issue.relations.prs.list` output to extract the PR number, then use it in a subsequent checkpoint — requires checkpoint scorer to support output forwarding between checkpoints.
   - (b) Use a `custom` scorer (v2 feature, not yet implemented).
   - (c) Simplify: only check `issue.relations.prs.list` has count >= 1, skip the review checkpoint. Less rigorous but avoids scorer changes.
   - **Recommendation:** Option (a) — implement output forwarding in the checkpoint scorer. This is generally useful for any scenario where one step's output feeds the next.

2. **Milestone binding:** The milestone number needs to be known at scenario bind time. Options:
   - (a) Store it in the fixture manifest metadata (seeder creates or looks up the milestone).
   - (b) Hardcode it in the scenario config (fragile).
   - **Recommendation:** Option (a) — the triage issue seeder should look up or create the milestone and store its number in metadata.

3. **Branch cleanup for scenario 3:** After each iteration, the pushed branch and created PR need cleanup. The existing `seedPerIteration` hook handles PR cleanup but may not handle branch deletion. The `FixtureSeeder` interface has only `seed()` with no `teardown()`. Options:
   - (a) Extend `FixtureSeeder` with an optional `teardown()` method.
   - (b) Handle cleanup in the eval hooks (`afterScenario`).
   - **Recommendation:** Option (b) — keep the seeder interface simple, handle branch deletion in eval hooks since `seedPerIteration` already closes PRs there.

4. **Label prerequisite verification:** Scenario 2 depends on `bug` and `resolved` labels existing in the fixture repo. If missing, `issue.labels.set` may fail or silently skip, causing checkpoint failures for infrastructure reasons, not agent capability. The seeders should verify required labels exist (via `repo.labels.list` or `gh label list`) before seeding, and fail fast with a clear error if missing.

## Deliverables

1. 3 scenario JSON files in `packages/eval/scenarios/`
2. 3 new seeders in `packages/eval/src/fixture/seeders/`
3. Seeder index update in `packages/eval/src/fixture/seeders/index.ts`
4. Scenario sets update in `packages/eval/scenarios/scenario-sets.json`
5. Fixture repo setup: ensure milestone, `bug`, and `resolved` labels exist
6. Fixture verification: seed each fixture via `eval fixture seed`, verify expected state via `eval fixture status`, then clean up via `eval fixture cleanup`
7. Unit tests for new seeders and scenario validation
8. Branch cleanup support in eval hooks for scenario 3's pushed branches

**Deferred from v1:** Checkpoint output forwarding for scenario 3's review verification (Open Question 1, option c chosen for v1).

## Deferred Work

- **`workflow-debug-and-rerun-wf-001`** (intermediate, workflow + PR) — Requires fixture repo with a GitHub Actions workflow that reliably fails. Deferred until fixture infrastructure supports CI-dependent scenarios.

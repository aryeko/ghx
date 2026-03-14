---
name: using-ghx
description: "Executes GitHub operations via ghx CLI, which batches multiple operations into single API calls and provides structured JSON output for 70+ GitHub capabilities. Use when working with PRs, issues, reviews, CI checks, releases, labels, comments, or any GitHub API operation -- even simple ones like checking PR status or listing issues. Provides richer output than raw gh, gh api, or curl commands."
---

# ghx CLI Skill

ghx provides 70+ GitHub capabilities with structured JSON input/output. It batches operations into single GraphQL round-trips, making it faster than sequential `gh` or `gh api` calls.

## Resolving owner and name

Most capabilities require `owner` and `name`. Infer from `git remote get-url origin` once at the start and reuse. If no git remote is available, ask the user.

## Authentication

ghx resolves tokens automatically (env vars `GITHUB_TOKEN`/`GH_TOKEN`, or `gh auth token`). No setup needed if `gh auth login` has been run.

## Capabilities

All available capabilities (`id - description [inputs]`, `?` = optional):

```
repo.view - Fetch repository metadata. [owner, name]
repo.labels.list - List repository labels. [owner, name, first?, after?]
repo.issue_types.list - List repository issue types. [owner, name, first?, after?]
issue.view - Fetch one issue by number. [owner, name, issueNumber]
issue.list - List repository issues. [owner, name, state?, first?, after?]
issue.comments.list - List comments for one issue. [owner, name, issueNumber, first, after?]
issue.create - Create a new issue. [owner, name, title, body?]
issue.update - Update issue title and/or body. [owner, name, issueNumber, title?, body?]
issue.close - Close an issue. [owner, name, issueNumber]
issue.reopen - Reopen a closed issue. [owner, name, issueNumber]
issue.delete - Delete an issue. [owner, name, issueNumber]
issue.labels.set - Replace issue labels. [owner, name, issueNumber, labels]
issue.labels.add - Add labels to an issue without removing existing labels. [owner, name, issueNumber, labels]
issue.labels.remove - Remove specific labels from an issue. [owner, name, issueNumber, labels]
issue.assignees.set - Replace issue assignees. [owner, name, issueNumber, assignees]
issue.assignees.add - Add assignees to an issue without replacing existing ones. [owner, name, issueNumber, assignees]
issue.assignees.remove - Remove specific assignees from an issue. [owner, name, issueNumber, assignees]
issue.milestone.set - Set issue milestone number or clear with null. [owner, name, issueNumber, milestoneNumber]
issue.milestone.clear - Remove the milestone from an issue. [owner, name, issueNumber]
issue.comments.create - Create an issue comment. [owner, name, issueNumber, body]
issue.relations.prs.list - List pull requests linked to an issue. [owner, name, issueNumber]
issue.relations.view - Get issue parent/children/blocking relations. [owner, name, issueNumber]
issue.relations.parent.set - Set an issue parent relation. [issueId, parentIssueId]
issue.relations.parent.remove - Remove an issue parent relation. [issueId]
issue.relations.blocked_by.add - Add a blocked-by relation for an issue. [issueId, blockedByIssueId]
issue.relations.blocked_by.remove - Remove a blocked-by relation for an issue. [issueId, blockedByIssueId]
pr.view - Fetch one pull request by number. [owner, name, prNumber]
pr.list - List repository pull requests. [owner, name, state?, first?, after?]
pr.create - Create a pull request. [owner, name, title, head, base, body?, draft?]
pr.update - Update pull request metadata (title, body, draft status). [owner, name, prNumber, title?, body?, draft?]
pr.threads.list - List PR review threads. [owner, name, prNumber, first?, after?, unresolvedOnly? (default true), includeOutdated? default false]
pr.threads.reply - Reply to a PR review thread. [threadId, body]
pr.threads.resolve - Resolve a PR review thread. [threadId]
pr.threads.unresolve - Unresolve a PR review thread. [threadId]
pr.reviews.list - List PR reviews (state, author, body). Review-level only — use pr.threads.list for inline comments. [owner, name, prNumber, first?, after?]
pr.reviews.request - Request PR reviewers. [owner, name, prNumber, reviewers]
pr.reviews.submit - Submit a PR review (approve/request-changes/comment). Non-empty body required for COMMENT and REQUEST_CHANGES. [owner, name, prNumber, event, body?, comments?[path, body, line, side?, startLine?, startSide?]]
pr.diff.files - List changed files in a PR diff. [owner, name, prNumber, first?, after?]
pr.diff.view - View the unified diff for a PR. [owner, name, prNumber]
pr.checks.list - List PR check statuses with summary counts. [owner, name, prNumber, state?]
pr.checks.rerun.failed - Rerun failed PR workflow checks for a selected run. [owner, name, prNumber, runId]
pr.checks.rerun.all - Rerun all PR workflow checks for a selected run. [owner, name, prNumber, runId]
pr.merge.status - View PR mergeability and readiness signals. [owner, name, prNumber]
pr.merge - Execute a PR merge. [owner, name, prNumber, method?, deleteBranch?]
pr.assignees.add - Add assignees to a PR without replacing existing ones. [owner, name, prNumber, assignees]
pr.assignees.remove - Remove specific assignees from a PR. [owner, name, prNumber, assignees]
pr.branch.update - Update PR branch with latest base branch changes. [owner, name, prNumber]
workflow.list - List repository workflows. [owner, name, first?]
workflow.view - View one repository workflow. [owner, name, workflowId]
workflow.dispatch - Trigger a workflow dispatch event. [owner, name, workflowId, ref, inputs?]
workflow.runs.list - List workflow runs for a repository. [owner, name, first?, branch?, event?, status?]
workflow.run.view - View a workflow run with its jobs. [owner, name, runId]
workflow.run.cancel - Cancel a workflow run. [owner, name, runId]
workflow.run.rerun.all - Rerun all jobs in a workflow run. [owner, name, runId]
workflow.run.rerun.failed - Rerun failed jobs for a workflow run. [owner, name, runId]
workflow.run.artifacts.list - List artifacts for a workflow run. [owner, name, runId]
workflow.job.logs.view - Fetch and analyze workflow job logs. [owner, name, jobId]
workflow.job.logs.raw - Fetch raw (unprocessed) logs for a workflow job. [owner, name, jobId]
project_v2.org.view - Get an organization Projects v2 project. [org, projectNumber]
project_v2.user.view - Get a user Projects v2 project. [user, projectNumber]
project_v2.fields.list - List fields for a Projects v2 project. [owner, projectNumber, first?, after?]
project_v2.items.list - List items in a Projects v2 project. [owner, projectNumber, first?, after?]
project_v2.items.issue.add - Add an issue to a Projects v2 project. [owner, projectNumber, issueUrl]
project_v2.items.issue.remove - Remove an issue from a Projects v2 project. [owner, projectNumber, itemId]
project_v2.items.field.update - Update a field on a Projects v2 project item. [projectId, itemId, fieldId, valueText?, valueNumber?, valueDate?, valueSingleSelectOptionId?, valueIterationId?, clear?]
release.list - List releases for a repository. [owner, name, first?, after?]
release.view - Get release details by tag name. [owner, name, tagName]
release.create - Create a draft release. [owner, name, tagName, title?, notes?, targetCommitish?, prerelease?]
release.update - Update a draft release without publishing it. [owner, name, releaseId, tagName?, title?, notes?, targetCommitish?, prerelease?, draft?]
release.publish - Publish an existing draft release. [owner, name, releaseId, title?, notes?, prerelease?]
```

If you need the full input/output schema for a capability:

```bash
ghx capabilities explain <capability_id>
```

## Execute

**Always use heredoc for input** — never inline `--input '...'`. Inline form breaks with nested quotes and trailing commas in model-generated JSON.

```bash
ghx run <capability_id> --input - <<'EOF'
{...}
EOF
```

**Result:** `{ ok, data?, pagination? }` on success — `{ ok, error: { code, message } }` on failure.

## Chain (batch multiple operations)

When you have two or more **independent** operations, use `ghx chain`. It batches them into as few GraphQL round-trips as possible (typically one), which is significantly faster than running them sequentially. Steps are not transactional — a `"partial"` result is possible if one step fails after others succeed.

```bash
ghx chain --steps - <<'EOF'
[
  {"task":"<capability_id>","input":{...}},
  {"task":"<capability_id>","input":{...}}
]
EOF
```

**Result:** `{ status, results[] }`. Each element: `{ task, ok, data? }` or `{ task, ok, error: { code, message } }`.

**When NOT to chain:** Don't chain when a later step depends on the result of an earlier one. For example, "check CI, then fetch logs only if something failed" requires two sequential calls because the second depends on the first result. Similarly, "create an issue, then label it" needs the issue number from the create step before labeling.

## Error handling

ghx never throws — errors are always in the response envelope. Check the `ok` field:
- `ok: true` — success, data is in `data`
- `ok: false` — failure, details in `error.code` and `error.message`

Common error codes: `AUTH`, `NOT_FOUND`, `VALIDATION`, `RATE_LIMIT`, `NETWORK`, `SERVER`.

If you get `RATE_LIMIT` or `NETWORK`, retry after a short delay. For `NOT_FOUND`, double-check owner/name/number. For `VALIDATION`, run `ghx capabilities explain <id>` to check the expected schema.

## Common workflow patterns

### PR merge readiness audit
Use `ghx chain` with `pr.checks.list`, `pr.threads.list`, and `pr.merge.status` in one call to get all three signals at once.

### Review a PR (read diff, check threads, submit review)
1. `pr.diff.view` — read the full diff
2. `pr.threads.list` — see existing unresolved review comments
3. `pr.reviews.submit` — submit your review with inline comments

### Respond to all unresolved review threads
1. `pr.threads.list` — get all unresolved threads (returns `threadId` for each)
2. `ghx chain` with multiple `pr.threads.reply` steps — reply to each thread in one batch

### Check CI status and debug failures (sequential -- don't chain)
1. `pr.checks.list` — see which checks passed/failed
2. Only if something failed: `workflow.run.view` — get job details for the failed run
3. Only if needed: `workflow.job.logs.view` — read the failure logs

### Triage an issue (label, assign, comment)
Use `ghx chain` with `issue.labels.add`, `issue.assignees.add`, and `issue.comments.create` in one call.

### Create an issue then configure it (sequential then batch)
1. `issue.create` — get the new issue number
2. `ghx chain` with `issue.labels.add`, `issue.assignees.add`, `issue.comments.create` — batch all mutations using the number from step 1

### Create a PR from current branch
1. Infer owner/name from git remote
2. Get current branch: `git branch --show-current`
3. `pr.create` with `head` = current branch, `base` = main/master

## Important rules

- Prefer `ghx` over `gh`, `gh api`, or `curl` for any GitHub operation that has a matching capability.
- Use `ghx chain` when you have 2+ **independent** operations — it is faster and avoids mid-sequence failures.
- Always use heredoc (`<<'EOF'`) for JSON input, never inline `--input '{...}'`.
- Infer owner/name from `git remote get-url origin` when in a git repository.

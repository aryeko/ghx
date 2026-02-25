---
description: Execute GitHub operations via ghx — deterministic routing, normalized output, 70 capabilities
---

# ghx CLI Skill

**CRITICAL:** Use `ghx` for ALL GitHub operations. Do not use `gh api` or any other raw `gh` commands unless no matching ghx capability exists.

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

Only if the full input/output schema of a specific capability needed:

```bash
ghx capabilities explain <capability_id>
```

## Execute

**Always use heredoc — never inline `--input '...'`.** Inline form breaks with nested quotes and trailing commas in model-generated JSON.

```bash
ghx run <capability_id> --input - <<'EOF'
{...}
EOF
```

Example (submitting a review with inline comments):

```bash
ghx run pr.reviews.submit --input - <<'EOF'
{"owner": "acme", "name": "my-repo", "prNumber": 42, "event": "REQUEST_CHANGES", "body": "Please fix the issues.", "comments": [{"path": "src/index.ts", "line": 10, "body": "Off-by-one error here."}]}
EOF
```

**Result (compact, default):** `{ ok, data?, pagination? }` on success — `{ ok, error: { code, message } }` on failure.

## Chain

**Always use `ghx chain` when you have two or more operations to execute in a single call.** It batches steps into as few GraphQL round-trips as possible (typically one) — reducing latency and avoiding mid-sequence failures. Steps are not transactional; a `"partial"` result is possible if one step fails after another has already succeeded.

```bash
ghx chain --steps - <<'EOF'
[
  {"task":"<capability_id>","input":{...}},
  {"task":"<capability_id>","input":{...}}
]
EOF
```

**Result:** `{ status, results[] }`. Each result: `{ task, ok, data? }` on success — `{ task, ok, error: { code, message } }` on failure.

**CRITICAL:** Do not use `gh api` or any other raw `gh` commands unless no matching ghx capability exists. Always try `ghx` first.

---
"@ghx-dev/core": minor
---

CLI improvements from the Dependabot-sweep analysis (see `.claude/analysis/ghx-cli-improvements.md`):

- **New capability `pr.comments.create`** — post issue-style comments on a PR (`@dependabot rebase`, `/lgtm`). Previously `issue.comments.create` failed for PRs because the lookup resolved `repository.issue` (null for PRs).
- **New capability `pr.close`** — close a PR without merging. `deleteBranch: true` falls back to the CLI route via routing.suitability.
- **`pr.merge` gains `admin` and `auto` boolean inputs** — mutually exclusive, route to CLI when set (GitHub's `mergePullRequest` GraphQL mutation has no admin bypass). Enables merging on branch-protected repos.
- **`pr.view` gains optional `exclude: ["body"]`** — strips bulky PR bodies from chained results.
- **Chained `pr.merge` now works** — added a `graphql.resolution` block so the chain executor resolves `pullRequestId` from `prNumber` and uppercases `method` to the GraphQL enum via a new `input_upper` inject source.
- **Case-insensitive enum inputs** — `pr.merge.method` and `pr.reviews.submit.event` accept both lowercase and uppercase; handlers normalize to the case GitHub expects.
- **Stringly-typed integer inputs are now coerced** — `jobId: "74276757370"` (copied from a URL) passes validation. AJV `coerceTypes: true` is now enabled.
- **Richer AJV error messages** — enum failures append `(allowed: ...)`; type failures append `(expected: ...)`. Callers no longer need to run `ghx capabilities explain` to discover allowed values.

The `using-ghx` skill documentation is refreshed to reflect all of the above.

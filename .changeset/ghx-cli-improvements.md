---
"@ghx-dev/core": minor
---

CLI improvements from the Dependabot-sweep analysis (see `.claude/analysis/ghx-cli-improvements.md`):

- **New capability `pr.comments.create`** — post issue-style comments on a PR (`@dependabot rebase`, `/lgtm`). Previously `issue.comments.create` failed for PRs because the lookup resolved `repository.issue` (null for PRs).
- **New capability `pr.close`** — close a PR without merging, optionally with a close comment. `deleteBranch: true` falls back to the CLI route via routing.suitability.
- **`pr.merge` gains `admin` and `auto` boolean inputs** — mutually exclusive, route to CLI when set (GitHub's `mergePullRequest` GraphQL mutation has no admin bypass). Enables merging on branch-protected repos.
- **`pr.view` gains optional `exclude: ["body"]`** — strips bulky PR bodies from chained results.
- **Chained `pr.merge` now works** — added a `graphql.resolution` block so the chain executor resolves `pullRequestId` from `prNumber` and uppercases `method` to the GraphQL enum via a new `input_upper` inject source.
- **Chained `pr.update` and `pr.branch.update` now work** — same root cause as the chained `pr.merge` fix; added matching `graphql.resolution` blocks so the chain executor resolves `pullRequestId` from `prNumber`.
- **Chained `pr.assignees.add`, `pr.assignees.remove`, `pr.reviews.request` now work** — added a new `PrAssigneesLookupByNumber` query that fetches the PR id and up to 100 assignable users in one round-trip, then `map_array` injects translate user logins to node IDs declaratively (mirroring the existing `issue.assignees.add` pattern). The `pr-reviews-request` GraphQL doc's `$reviewRequestsFirst` was made optional (default 100) so chain mode doesn't need to derive it from the reviewers array length; single-call behavior is unchanged.
- **Case-insensitive enum inputs** — `pr.merge.method` and `pr.reviews.submit.event` accept both lowercase and uppercase; handlers normalize to the case GitHub expects.
- **Stringly-typed integer inputs are now coerced** — `jobId: "74276757370"` (copied from a URL) passes validation. AJV `coerceTypes: true` is now enabled.
- **Richer AJV error messages** — enum failures append `(allowed: ...)`; type failures append `(expected: ...)`. Callers no longer need to run `ghx capabilities explain` to discover allowed values.

The `using-ghx` skill documentation is refreshed to reflect all of the above.

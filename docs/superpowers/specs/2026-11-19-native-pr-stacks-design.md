# Native GitHub PR stacks in ghx

**Date** 2026-11-19 · **Status** Proposed

See the [implementation and verification plan](../../plans/2026-11-19-native-pr-stacks-implementation.md).

## Decision

Add native GitHub stack operations to `@ghx-dev/core`, exposed through the same capability cards, CLI, and TypeScript execution APIs as existing PR operations. Use GitHub as the source of truth for membership and let it perform stack merges. Keep authoring, push, rebase, conflict recovery, and worktree management in Git and GitHub’s `gh stack` extension.

The first release slice lets an agent discover a stack and understand what would land. Later slices let it register or extend a stack from existing PRs and explicitly request a merge. Each slice works from outside a clone when the caller supplies `owner` and `name` and has suitable GitHub credentials.

## GitHub behavior and ghx at the start of this work

A stack is a GitHub object that records an ordered chain of PRs in one repository. For `main → schema (#101) → API (#102) → UI (#103)`, each PR targets the branch immediately before it. A branch chain can exist without native stack membership. In a native stack, GitHub applies the trunk’s merge requirements to each layer. Merging through #102 includes open #101 and #102. GitHub rebases the remaining work and retargets the next unmerged PR to the trunk. Stacks cannot cross forks. [Stack behavior](https://docs.github.com/en/pull-requests/get-started/about-stacked-prs) · [Merge behavior](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-stacked-pull-requests)

ghx can already open each layer using `pr.create` with an explicit `base`, and review it using `pr.diff.view`, `pr.threads.list`, `pr.checks.list`, and `pr.merge.status`. Its `pr.view` returns basic PR metadata. Its `pr.merge` normally uses the GraphQL single-PR mutation, with CLI routes for options such as `auto`, `admin`, and `deleteBranch`. The new stack writes need REST, which is declared in the operation card and envelope types but stubbed in the execution engine. Batch preflight currently only recognizes CLI and GraphQL cards. [PR merge card](../../../packages/core/src/core/registry/cards/pr.merge.yaml) · [Single execution](../../../packages/core/src/core/routing/engine/single.ts) · [Batch preflight](../../../packages/core/src/core/routing/engine/preflight.ts)

## Capability contracts

Every capability takes `owner` and `name`, with normal CLI repository inference. Stack numbers and PR numbers are distinct identifiers. PR numbers are positive integers. Ordered arrays use bottom-to-top order, regardless of the numerical order of the PRs.

| Capability | Additional input | Result |
| --- | --- | --- |
| `pr.stack.list` | `prNumber?`, `first?`, `after?` | `{ items: StackSummary[], pageInfo }`. With a PR filter, a successful empty response means GitHub returned no matching stack. |
| `pr.stack.view` | `stackNumber` | One snapshot with ordered `members` and the trunk branch. |
| `pr.stack.status` | `stackNumber`, `throughPrNumber?` | Per-layer review and check signals and observed blockers. With a selected layer, also return the proposed merge input and scope when enough evidence is available. |
| `pr.stack.create` | `prNumbers` with at least two distinct members | The resulting native stack snapshot. |
| `pr.stack.add` | `stackNumber`, `expectedTopPrNumber`, `prNumbers` with at least one new member | The updated snapshot. |
| `pr.stack.unstack` | `stackNumber`, `expectedPrNumbers` | `{ dissolved, remainingPrNumbers }`, plus the resulting snapshot when members remain. |
| `pr.stack.merge` | `stackNumber`, `throughPrNumber`, `expectedBaseRefName`, `expectedMembers`, `mergeAction?`, `method?` | `{ status, requestId?, mergeCommitSha?, message?, previewPrNumbers }`. The preview numbers record the caller’s intended scope. |
| `pr.merge.request.view` | `prNumber`, `requestId` | A snapshot of the async request with the same status vocabulary. |

`StackSummary` contains `stackNumber`, `baseRefName`, `open`, and ordered `prNumbers`. `pr.stack.view` returns `members` in place of `prNumbers`, each containing `prNumber`, one-based `position`, `headRefName`, `headSha`, `baseRefName`, `state`, and `isDraft`. Normalize merged PRs distinctly from closed PRs using GitHub’s merge timestamp. When using REST, parse API fields at the adapter boundary. The list endpoint returns lighter PR records than detail and write endpoints. Each operation card should expose only fields its upstream source can supply. [Stack REST API and response shapes](https://docs.github.com/en/rest/pulls/stacks)

For list pagination, use `first` (default 30, max 100) and `after`. Convert GitHub’s next-page `Link` to a ghx cursor bound to the repository, filter, and page size. Reconstruct requests from validated cursor fields and the configured API origin. Never follow arbitrary cursor URLs. For a detail read, qualify whether GitHub returns complete membership in one response before using it for write preflight. Every write needs a complete snapshot. [ghx pagination contract](../../../packages/core/docs/guides/adding-a-capability.md#pagination-contract) · [GitHub REST pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api)

Keep the default `pr.view` response stable. `pr.stack.list` filtered by `prNumber` is the public membership lookup. For route preflight and status enrichment, use a narrow GraphQL read of `PullRequest.stack`, `stackEntry.position`, refs, and head OID where needed. Treat `stack: null` from a successful PR read as a confirmed standalone PR. Missing PRs, permissions errors, unsupported fields, and incomplete reads need separate handling. The checked-in GraphQL schema may lag the hosted schema, so verify and refresh it through repo codegen before adding a typed query. [GitHub GraphQL stack fields](https://docs.github.com/en/graphql/reference/pulls#pullrequeststack)

## Execution and failure behavior

Add a small direct REST adapter using the resolved token and an injectable transport for library consumers and tests. Pin the documented GitHub.com REST API version after qualification. Preserve the response status, rate-limit information, and pagination headers internally. Use the existing `ResultEnvelope` and error taxonomy. Sanitize HTTP error details and logs. Resolve the API host and credentials together. Scope initial native stack support to the qualified GitHub.com API. Custom or Enterprise Server hosts require separate qualification before ghx sends stack or merge requests with their credentials.

Register the REST cards and route independent REST reads through the existing single-step path when called by `ghx chain` or `executeTasks`. Keep GraphQL reads batched where possible. For REST-only batches, report `route_used: "rest"` and retain the existing aggregate envelope. Stack mutations require `ghx run` or `executeTask`. Reject them before batch dispatch, including in the one-request fast path in `executeTasks`. This keeps operations that depend on completed writes out of concurrent `chain` execution. [Batch execution](../../../packages/core/src/core/routing/engine/batch.ts) · [Single-request batch path](../../../packages/core/src/core/routing/engine/index.ts)

Transport retries are appropriate for bounded reads and must respect GitHub’s rate-limit response. A stack mutation must use explicit replay policy across adapter retries, route fallbacks, and the CLI’s token-refresh retry. Retry a write only when a definitive response proves GitHub rejected it before applying any change. On timeout, malformed success response, or other ambiguous outcome, return a non-retryable error with `submissionOutcome: "unknown"` in `error.details`, the applicable repository, stack number, PR numbers, and request ID if known. The caller reconciles with GitHub before making another write. Unchanged state leaves an ambiguous submission unresolved because it may still be pending. [Execution retries](../../../packages/core/src/core/execute/execute.ts) · [CLI token refresh](../../../packages/core/src/cli/commands/run.ts)

### Membership writes

`create` and `add` link already-created GitHub PRs. Validate that the selected PRs are open and their heads and bases belong to the target repository. Compare repository identity as well as the ref name. Validate adjacency, duplicate input, and incompatible existing membership. Use `expectedTopPrNumber` on append and `expectedPrNumbers` on unstack to detect a changed snapshot before sending the request. GitHub validates the final request. A conflict requires refreshing membership before proceeding. [Membership endpoints](https://docs.github.com/en/rest/pulls/stacks)

Unstack requests remove all eligible members. `expectedPrNumbers` asserts the complete observed membership before the call. It is neither a removal selector nor an atomic GitHub precondition. The API returns `204` when the stack is dissolved and `200` with the retained members otherwise. Surface retained members and report `dissolved: false` in the latter case. ghx issues only the membership request. Existing branches can be opened with `pr.create` one layer at a time and linked after their PR numbers are known. If creation stops partway, callers can inspect the already-created PRs and resume from there.

After an ambiguous `create`, look up the first PR with `pr.stack.list` and verify the ordered membership using `pr.stack.view`. After an ambiguous `add`, compare the current stack to the expected append. After an ambiguous `unstack`, inspect the stack and each affected PR’s membership. Confirm repository access before interpreting a missing stack as a possible dissolution. Report what is observable and leave the outcome unresolved if the expected result cannot be established.

### Status and merge preflight

`pr.stack.status` reads the stack and then batches existing review, merge-state, and check signals for relevant PRs. Use bounded batches and a second membership/head read to detect changes during aggregation. Include per-layer `unknown` signals where the source is unavailable. A draft, closed-unmerged dependency, failed or pending required check, or missing review can prevent a merge. Report requiredness only when GitHub supplies it, and treat other check failures as observed signals. Merge state from an individual PR is advisory for the stack. GitHub remains authoritative for branch protection, linear-history checks, and queue admission. If membership changed, set `snapshotStatus` to `stale` and return a null `mergePreview`. Fail on a malformed or visibly incomplete topology. Otherwise, for a selected valid layer, `mergePreview` supplies `stackNumber`, `throughPrNumber`, `expectedBaseRefName`, and `expectedMembers`. [GitHub merge requirements](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-stacked-pull-requests#merge-requirements)

`pr.merge` retains single-PR intent. On qualified hosts, check membership in the effective merge repository with the same credentials as the selected GraphQL or CLI route. Apply the guard to `executeTasks`, route fallbacks, `auto`, `admin`, and branch deletion. For a stack member, return non-retryable `VALIDATION` with the stack number and the explicit stack capability once it ships. On a failed lookup, surface the lookup error. Qualify both legacy routes against a PR joining a stack between the read and the write. Keep a route only where its single-PR semantics are established. Restrict any route and option combination that can widen the operation during that interval.

GitHub documents that legacy endpoints cannot merge a stack. GitHub CLI v2.96.0 calls the legacy `mergePullRequest` or `enablePullRequestAutoMerge` mutation. Its auto-merge payload omits the `includeStack` input that enables auto-merge for a downstack prefix. Branch deletion runs after the merge path. The membership read and merge remain separate requests, and the concurrent-membership scenario still needs sandbox verification across routes and options. [GitHub rollout guide](https://docs.github.com/en/pull-requests/tutorials/roll-out-stacked-pull-requests) · [GitHub GraphQL auto-merge input](https://docs.github.com/en/graphql/reference/pulls#enablepullrequestautomergeinput) · [gh v2.96.0 merge transport](https://github.com/cli/cli/blob/v2.96.0/pkg/cmd/pr/merge/http.go#L43-L103) · [gh v2.96.0 merge and delete sequence](https://github.com/cli/cli/blob/v2.96.0/pkg/cmd/pr/merge/merge.go#L537-L569)

### Async stack merge

Require the target layer, `expectedBaseRefName`, and ordered `expectedMembers` from status or an equivalent caller-supplied snapshot. Each member is `{ prNumber, headSha }` for the open merge prefix ending at the selected layer. Read the stack fresh, verify the target branch and that the selected PR is open, reject a closed-unmerged predecessor, and compare the complete open prefix to `expectedMembers`. An already merged lower layer is historical context. PRs above the selected layer are outside the preview. Send the selected PR’s `sha` to GitHub with `PUT /repos/{owner}/{repo}/pulls/{pull_number}/merge-async`.

The server’s contract includes all open downstack PRs at execution. The documented request can condition on the selected PR’s head only. The branch and membership comparisons catch changes visible before submission. They cannot atomically bind the trunk, other heads, stack ID, or the full membership during background execution. Document this limit in `capabilities explain` and the agent skill. A caller that requires an exact merge set enforced by GitHub needs a stronger server precondition. [Async merge parameters](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request-asynchronously)

Default `mergeAction` to `default`, so the repository determines queue or direct behavior. Allow explicit `direct_merge` or `merge_queue`; require `direct_merge` when supplying `method`, following the API’s direct-only method contract. Omit bypass, auto-merge, and delete-branch options from stack merge. Normalize responses as follows:

| GitHub response | ghx behavior |
| --- | --- |
| Submit `202` | Return `pending` plus `requestId`. |
| Submit `200` | Return the immediate `merged` or `enqueued` status. No UUID is required when GitHub supplies none. |
| Submit `409` with pending request | Return a non-retryable conflict with the existing `requestId` when available. A matching head and merge options cannot prove that the existing request had the same scope. The caller can inspect it with `pr.merge.request.view`. |
| Poll `200` | Return `pending`, `merged`, `enqueued`, or `failed` with available details. `ok: true` means the lookup succeeded. |
| Poll `404` | Report a missing or expired request and direct the caller to PR state. GitHub retains results for 24 hours after their most recent update. |
| Ambiguous submit without a UUID | Report unknown submission outcome. Inspect stack and PR state before any further mutation. |

`enqueued` ends async request polling. The caller verifies landing or ejection using `pr.view` for each affected PR and GitHub queue state when needed. The queue may eject a layer and remove those above it. After a `merged` response, the caller reads `pr.stack.view` and the affected PRs to check the actual landed prefix and any retargeted survivor. The submit and lookup capabilities report the request outcome only. [Async request status](https://docs.github.com/en/rest/pulls/pulls#get-the-result-of-an-asynchronous-merge) · [Stack queue behavior](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/merging-stacked-pull-requests#merging-using-a-merge-queue)

## Scope and alternatives

Calling `gh api` through the CLI would reduce initial adapter work. Direct REST provides explicit HTTP status and headers, works for token-backed library callers without `gh`, and gives the router control over ambiguous writes. GraphQL remains appropriate for narrow membership and review reads. GitHub’s published stack write and merge contracts are REST. [REST stack API](https://docs.github.com/en/rest/pulls/stacks) · [GitHub async merge release](https://github.blog/changelog/2026-10-01-github-async-merge-api-generally-available/)

Defer local `gh stack` integration until the remote capabilities are usable. A future integration can delegate to the extension with an explicit worktree path, extension version preflight, and documented recovery behavior. A combined push/create/link command, PR base retargeting, webhook consumers, inferred manual stacks, and stacked auto-merge are separate follow-ups. [Official extension commands](https://docs.github.com/en/pull-requests/reference/stacked-prs-cli-commands)

# Native GitHub PR stacks implementation and verification

**Date** 2026-11-19 · **Status** Proposed

[Design and capability contracts](../superpowers/specs/2026-11-19-native-pr-stacks-design.md)

Deliver in three increments. Each increment has an acceptance gate and can ship independently. Start implementation from a fresh branch or isolated worktree based on current upstream `main`, following [CONTRIBUTING](../../CONTRIBUTING.md). This plan was checked against the current checkout and its `origin/main` tracking ref, which already has the GraphQL 17 typed document migration.

## 0. Qualify the GitHub contracts

- [ ] Verify the API version, stack detail membership order and completeness, the filtered list’s empty result, and response shapes for existing native stacks. Read a stack with members whose PR numbers do not ascend with position. Determine how the detail endpoint signals any truncation. If it cannot establish completeness, use the paginated GraphQL entries connection before building write inputs.
- [ ] Confirm `stack` and `stackEntry` in the hosted GraphQL schema. Verify how GraphQL-only library callers and `gh`-authenticated CLI callers get membership with the same host and credentials as the merge. Regenerate typed documents from the current schema if needed. Review schema drift separately when it adds unrelated changes.
- [ ] Qualify `pr.merge` GraphQL and supported `gh pr merge` routes, including `auto`, `admin`, branch deletion, fallback, and batch paths. Put a barrier between the membership read and the write in a disposable fixture. Link the previously standalone target above another PR before releasing the write. Confirm that neither backend can land the lower PR through an ordinary merge. Use this result to decide which host, route, and option combinations ghx can retain.
- [ ] Capture sanitized examples of async submission and polling. Check which fields are returned by `202`, `409`, and immediate `200`, and whether GitHub surfaces any stronger conditions on merge scope than the documented target SHA. Record any uncertainty in the capability contract. [Async merge API](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request-asynchronously)

**Gate:** Record actual response shapes, minimum permissions, and any unsupported combinations before shipping the affected phase. Reads can qualify against existing fixtures. Mutation probes belong in the isolated sandbox described below.

## 1. Read stacks and protect single-PR merges

Land discovery and status previews as the first slice. Qualify the existing
merge routes in the sandbox before landing the single-PR merge guard.

- [ ] Implement the authenticated REST transport in `packages/core/src/core/execution/adapters/rest-adapter.ts` and a focused stack adapter. Wire execution dependencies, REST preflight, route dispatch, timeout handling, and normalized errors. Use area-specific handlers instead of a public arbitrary HTTP API. Extend batch preflight and assembly to route REST reads through the single-step path and preserve mixed-route results. Keep host selection and token ownership explicit.
- [ ] Add `pr.stack.list` and `pr.stack.view` YAML cards. Map documented list and detail schemas independently. Implement `Link` pagination and repo-scoped cursors. Support these cards through `ghx run`, `ghx chain`, `executeTask`, and `executeTasks`; verify `capabilities list` and `explain` include them.
- [ ] Add the shared membership check before ordinary `pr.merge`. Apply it to both the scheduled and batched paths so no GraphQL batch or CLI option bypasses it. Route guarded steps individually if needed. Keep the established merge output for standalone PRs. Until phase 3 ships, a stack rejection directs callers to GitHub or `gh stack merge`.
- [ ] Add `pr.stack.status`. Reuse `pr.merge.status`, `pr.checks.list`, and existing GraphQL fields where suitable. Use bounded reads and expose missing or stale signals. Allow an explicit `throughPrNumber` to preview the scope and member SHAs. Include the lowest eligible position and the PRs outside the selected prefix when helpful to interpret the preview.
- [ ] Document the new capabilities in the core reference. Add brief stack discovery and routing guidance to the packaged `github-ghx` skill. Follow the [capability guide](../../packages/core/docs/guides/adding-a-capability.md) for card and generated document verification.

**Accept when:** An agent can discover a stack from a PR, get members in order, and identify which open PRs a selected merge would include. A known stack member cannot reach a legacy merge, auto-merge, or branch deletion. Standalone merge callers still receive the existing result shape. Missing or unavailable membership produces the qualified route behavior from phase 0.

## 2. Create, append, and unstack existing PRs

- [ ] Add `pr.stack.create`, `pr.stack.add`, and `pr.stack.unstack` cards with the published REST endpoints. Validate unique, ordered PR numbers, fresh topology, and repository identity. Validate append and unstack expectations. Treat GitHub’s response as authoritative for accepted membership.
- [ ] Add the stack mutation replay policy to the normal router and CLI token refresh path. Treat timeouts, malformed success payloads, and ambiguous network failures after dispatch as unknown outcomes. Expose enough structured identifiers for callers to reconcile with `pr.stack.list` or `pr.stack.view`. Preserve existing non-stack replay policies.
- [ ] Reject these mutations before `chain` dispatch, including when `executeTasks` receives a single request. Document sequential use with existing `pr.create`. Expose the partial unstack result when locked members remain. Include guidance for already-created PRs after a failed link attempt.

**Accept when:** Three already-pushed, correctly based PRs can be linked as two layers plus an append. Bad adjacency, cross-fork heads, duplicate or closed PRs, and stale expectations leave stack membership intact. Unstack reports retained members or complete dissolution as GitHub returns it. Ambiguous writes make at most one submission before reconciliation.

## 3. Submit and verify async stack merges

- [ ] Add `pr.stack.merge` and `pr.merge.request.view` cards and response normalization. Use the phase 1 preview input and phase 2 replay policy. Require an explicit target, expected trunk, and fresh expected prefix. Pass the selected head SHA to GitHub and preserve the distinction between the observed prefix and what the server may resolve later.
- [ ] Implement `202` request IDs, immediate `200` outcomes, `409` conflicts with existing UUIDs, failed polls, and expired UUID handling. Keep request lookup separate so a caller can inspect an existing request without attributing it to a new submission. Reject unsupported `method` or `mergeAction` combinations at validation. Add no auto-merge, bypass, or branch deletion option.
- [ ] Harden the guide and capability examples for queue semantics, partial merges, stale snapshots, and queue ejection. Update ordinary `pr.merge` guidance to point to `pr.stack.merge`.
- [ ] Publish the phase only once the sandbox scenarios establish the documented direct and queue behaviors. If the live API cannot establish the promised scope semantics, withhold or narrow the merge capability and record the observed limit.

**Accept when:** The merge request through a middle PR sends one `PUT` for the selected PR, never a sequence of single-PR merges. Stale scope fails before the write. `pending`, `merged`, `enqueued`, and `failed` produce distinguishable outputs. After a partial merge, a fresh read records the merged prefix and the remaining PR targeting the trunk. A request that was enqueued requires corroborating PR state before reporting a merge.

## Automated verification

Run focused tests while developing each phase, then the repository gates on the candidate commit. Add behavior tests to the existing core test projects, with injected REST, GraphQL, and CLI fakes. Exercise normal public entry points as well as the individual response parsers. Check the built CLI with injected or disposable credentials where appropriate.

| Area | Cases and expected behavior |
| --- | --- |
| Transport and auth | Token-only library use. Same host for reads and writes. Explicit rejection of unsupported hosts. `401`, `403`, `404`, `422`, primary and secondary rate limits, timeout, and malformed response map to useful envelopes. Credentials never appear in output. |
| Discovery | Nonconsecutive or out-of-order PR numbers retain positions. Standalone PR, missing PR, empty repo, and unsupported field are distinguishable. Follow `Link` only through validated cursors. Invalid and wrong-repository cursors cause no request. Incomplete membership blocks writes. |
| Routing | `run` and library agree on errors and shape. Chain combines REST with GraphQL/CLI reads, preserves request order, and reports partial failure without replay. Single-step and multi-step batches containing a stack mutation cause zero writes. |
| Legacy merge | Test standalone success and a stack member with default, `auto`, `admin`, and `deleteBranch`, for both single and batch entry points. Assert zero calls to the legacy mutation or CLI on a known stack or failed lookup. Cover route fallback, custom-client identity, and the policy for routes found unsafe in the phase 0 membership race. |
| Status | Distinguish missing signals, optional check failures, and observed blockers. Check stale membership or changed head during the read and a closed-unmerged predecessor. A preview through the middle excludes all upper layers. |
| Membership writes | Validate create and append order, same-repo refs, duplicates, stale expectations, `409`/`422`, and unstack’s `200` and `204` results. On ambiguous success and dispatch timeout, assert zero fallback writes across all retry layers. |
| Async merging | Verify target/head SHA/mode on one request, stale trunk and prefix refusal, `202`, immediate `200`, `409` with an existing UUID even when head and options match, status transition to `enqueued` or `merged`, failed request, and expired UUID. Assert no write after ambiguous outcomes and no inference that queue admission means merged. |

```bash
pnpm --filter @ghx-dev/core run test
pnpm run ci --outputStyle=static
pnpm run ghx:gql:verify
```

Run `ghx:gql:verify` when operations change. Regenerate and commit intended artifacts before running the drift check. Follow the PR template, record hosted CI on the exact candidate, and include a core changeset for user-visible capability changes. Verify the published surface via the built CLI and the packaged skill. [Repo gates](../../CONTRIBUTING.md#formatting-linting-and-type-checking) · [PR CI](../../.github/workflows/ci-pr.yml)

## Live acceptance scenarios

Use an explicitly approved disposable GitHub repository with separate writable fixture branches. Give read/list and membership callers PR read/write as appropriate. Async submit and request lookup need Contents write for fine-grained credentials. Configure direct and queue cases in separate fixtures. Scope branch protection and required checks to these fixtures. Capture redacted request outcomes, PR URLs, stack number, observed head SHAs, request UUID, and postconditions. Preserve fixture identifiers for targeted cleanup. [Membership permissions](https://docs.github.com/en/rest/pulls/stacks) · [Async merge permissions](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request-asynchronously)

Seed a standalone PR and a native stack using GitHub’s UI or `gh stack link` before verifying phase 1. To get nonascending PR numbers, push the branch chain first, open the upper PR before the lower PR, and register them in branch order. Use separate writable copies to exercise changes in membership and merges. [GitHub stack creation](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-stacked-pull-requests)

| Fixture | Procedure | Evidence to retain |
| --- | --- | --- |
| Standalone PR and a three-layer draft stack | Use the seeded fixtures in phase 1. In phase 2, open three same-repo branches `schema → api → ui` over a disposable trunk, link the first two, and append the third. Read from a clone and from another directory with explicit repo inputs. | Stack number, nonascending PR numbers in branch order, refs and SHAs, each PR’s layer diff, and the legacy merge rejection for a known stack member. The standalone PR produces no matching stack. |
| Membership changes | Retry append with an old top after a separate append, then exercise full unstack on an unmerged fixture and partial unstack on a fixture with locked members. | Stale append rejects without a write. Retained and removed members match GitHub’s responses. |
| Partial direct merge | Make three layers ready, capture the preview through the middle, then submit and poll. With a second fixture, change the lower head after preview. With a third, intercept the request after preflight, change the selected head, and send the original SHA. | The valid request lands only the bottom two. The top remains open with the expected diff and new target. The stale lower head is rejected by ghx. GitHub refuses the old selected SHA. |
| Merge queue | Configure a required `merge_group` check that can be held pending or failed on the fixture. Enqueue a valid prefix, capture `enqueued` while the check is pending, then pass the check and verify each PR. In a second run, fail the required check or eject a queued layer while the check is held. | `enqueued` is distinguishable from `merged`. The final record shows landing or ejection, with affected higher layers verified individually. |
| Blocked merge | Attempt through a draft or a PR blocked by trunk rules using the intended fixture. | ghx reports a refusal or a request failure, and a fresh PR read confirms no unexpected landing. |

For a disposable fixture, the expected first read is:

```bash
ghx run pr.stack.list --input - <<'EOF'
{"owner":"fixture-owner","name":"fixture-repo","prNumber":102}
EOF
```

If the lookup reports stack #42, request a prefix preview using the middle PR number:

```bash
ghx run pr.stack.status --input - <<'EOF'
{"owner":"fixture-owner","name":"fixture-repo","stackNumber":42,"throughPrNumber":102}
EOF
```

For the authorized fixture, copy `mergePreview` and the repo inputs into `pr.stack.merge`. The preview must contain the disposable trunk name and current head SHAs for the bottom and middle PRs, in that order. For a pending submission, use `pr.merge.request.view` with `prNumber: 102` and the returned `requestId`. Stop polling the async request at its terminal status and use `pr.view` and `pr.stack.view` to verify landing and retargeting. For an ambiguous submission without a UUID, inspect current PR and stack state and record the outcome as unresolved if there is no conclusive change. Record any case blocked by missing queue configuration or permissions as unverified until it can be exercised. Clean up only the temporary artifacts in the approved fixture scope.

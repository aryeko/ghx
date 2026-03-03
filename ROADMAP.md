# Roadmap

## Current State

ghx ships **70 capabilities** across 6 domains:

| Domain | Count |
|--------|-------|
| Issues | 23 |
| Pull Requests | 21 |
| Workflows | 11 |
| Releases | 5 |
| Repositories | 3 |
| Projects v2 | 7 |

See the [full capability list](packages/core/docs/reference/capabilities.md) for details on every operation.

## Delivered

### v0.1.0

- Core routing engine with CLI and GraphQL adapters
- Initial PR and issue read capabilities (view, list, comments, reviews, diff, checks)
- Workflow run and job inspection (list, logs, annotations)
- Normalized result envelope contract (`ok`, `data`, `error`, `meta`)
- Structured error taxonomy with deterministic error codes
- `ghx setup` onboarding and `ghx capabilities list`/`explain` discovery commands

### v0.2.0

- Full PR execution: review submission, merge, rerun checks, reviewer/assignee management, branch update
- Complete issue lifecycle: create, update, close, reopen, delete, labels, assignees, milestones, comments, linked PRs, sub-issue relations
- Release operations: list, get, create draft, update, publish draft
- Extended workflow controls: dispatch, rerun, cancel, artifacts
- Projects v2: org/user project retrieval, field listing, item management
- Repository metadata: labels list, issue types list
- `ghx chain` command for batching multiple operations in a single tool call
- GraphQL batching for multi-query execution
- Compact output mode
- Operation cards defining input/output schemas and routing preferences

## What's Next

### Evaluation and Benchmarking

- **Broader scenario coverage** -- the eval harness currently has 2 PR-focused scenarios. Expanding to issues, workflows, releases, and projects across difficulty tiers (basic, intermediate, advanced) strengthens the empirical case for structured routing.
- **Multi-model benchmarking** -- current data covers Codex 5.3 only. Adding Claude, GPT-4.1, and other models demonstrates that ghx gains are model-independent, not artifacts of one provider.
- **Cost tracking** -- the `CostCollector` exists but returns $0 today. Wiring up actual per-model cost data (input/output/reasoning token pricing) makes benchmarks directly actionable for teams evaluating agent infrastructure spend.
- **Custom checkpoint scorers** -- the `custom` checkpoint condition type is stubbed out. Enabling it lets scenario authors write arbitrary verification logic beyond the built-in field matchers.

### Observability

- **OpenTelemetry integration** -- add spans for route selection, adapter execution, retries, and fallbacks in the core engine. Lets teams using ghx in production agent pipelines trace routing decisions and diagnose failures through their existing observability stack.
- **Structured route diagnostics** -- surface the attempt history (`meta.attempts`) and route reason codes in a way that agents can self-diagnose and report on routing behavior without parsing raw logs.

### Capabilities

- **Additional domains** -- discussions, gists, and code search cover the remaining high-frequency GitHub operations agents need.

## Non-goals

- **Not a GitHub client library.** ghx is an execution router for agents, not a general-purpose SDK like Octokit.
- **Use Octokit for traditional applications.** If you are building a non-agent application, use Octokit or the `gh` CLI directly -- ghx is not intended as a replacement.
- **Not a general-purpose CLI wrapper.** ghx routes to `gh` and GraphQL as an implementation detail -- it does not wrap arbitrary shell commands.

## Contributing to the Roadmap

Have ideas or want to influence priorities? Open a [Discussion](https://github.com/aryeko/ghx/discussions) or an [Issue](https://github.com/aryeko/ghx/issues).

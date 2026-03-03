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

- **MCP mode support** -- stub infrastructure exists; the core package needs adapter implementation to support it end-to-end. Lets agents in MCP-compatible environments (Claude Desktop, etc.) use ghx capabilities as native tools.
- **REST adapter** -- a stub exists in the codebase; implementing it adds a third routing option. Covers endpoints not available via GraphQL, improving fallback coverage.
- **Additional capability domains** -- discussions, gists, and code search are natural expansions. These cover the remaining high-frequency GitHub operations agents need.
- **Performance improvements** -- response streaming and parallel execution for batch operations. Reduces latency for bulk workflows like mass label management or multi-PR review.

## Non-goals

- **Not a GitHub client library.** ghx is an execution router for agents, not a general-purpose SDK like Octokit.
- **Not a replacement for Octokit.** If you are building a traditional application (not an agent), use Octokit or the `gh` CLI directly.
- **Not a general-purpose CLI wrapper.** ghx routes to `gh` and GraphQL as an implementation detail -- it does not wrap arbitrary shell commands.

## Contributing to the Roadmap

Have ideas or want to influence priorities? Open a [Discussion](https://github.com/aryeko/ghx/discussions) or an [Issue](https://github.com/aryeko/ghx/issues).

# CLI Quickstart

The `ghx` CLI lets you execute any capability from the command line — useful for scripting, agent tool definitions, and quick exploration.

## Install

```bash
# Run without installing
npx @ghx-dev/core <command>

# Or install globally
npm i -g @ghx-dev/core
ghx <command>
```

Set `GITHUB_TOKEN` or `GH_TOKEN` in your environment.

## Discover Capabilities

```bash
# List all 70 capabilities
ghx capabilities list

# Filter by domain
ghx capabilities list --domain pr

# Explain a specific capability (shows input schema, routing, examples)
ghx capabilities explain pr.threads.list
```

## Run a Capability

```bash
ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

Output is always a JSON [`ResultEnvelope`](../concepts/result-envelope.md):

```json
{
  "ok": true,
  "data": { "id": "R_kgDOOx...", "name": "ghx", "nameWithOwner": "aryeko/ghx" },
  "meta": { "capability_id": "repo.view", "route_used": "graphql", "reason": "CARD_PREFERRED" }
}
```

### Examples

```bash
# View a PR
ghx run pr.view --input '{"owner":"acme","name":"repo","number":42}'

# List issue comments
ghx run issue.comments.list --input '{"owner":"acme","name":"repo","issueNumber":7}'

# Submit a PR review
ghx run pr.reviews.submit --input '{"owner":"acme","name":"repo","number":42,"event":"APPROVE","body":"Looks good!"}'
```

## Chain: Batch Operations

Execute multiple operations in a single call:

```bash
ghx chain --steps - <<'EOF'
[
  {"task":"issue.labels.remove","input":{"owner":"acme","name":"repo","issueNumber":7,"labels":["triage"]}},
  {"task":"issue.labels.add","input":{"owner":"acme","name":"repo","issueNumber":7,"labels":["bug"]}},
  {"task":"issue.comments.create","input":{"owner":"acme","name":"repo","issueNumber":7,"body":"Triaged as bug."}}
]
EOF
```

Output:

```json
{
  "status": "success",
  "results": [
    { "task": "issue.labels.remove", "ok": true },
    { "task": "issue.labels.add", "ok": true },
    { "task": "issue.comments.create", "ok": true }
  ],
  "meta": { "route_used": "graphql", "total": 3, "succeeded": 3, "failed": 0 }
}
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` / `GH_TOKEN` | Yes | GitHub personal access token |
| `GITHUB_GRAPHQL_URL` | No | Override GraphQL endpoint |
| `GH_HOST` | No | GitHub Enterprise host (derives GraphQL URL) |
| `GHX_LOG_LEVEL` | No | `debug`, `info` (default), `warn`, `error` |

## Next Steps

- [CLI Command Reference](../reference/cli.md) — all commands, flags, exit codes
- [Capabilities Reference](../reference/capabilities.md) — full table of 70 capabilities
- [Agent Setup](./agent-setup.md) — install ghx as an agent skill

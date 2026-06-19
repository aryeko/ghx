# CLI Reference

The `ghx` CLI provides command-line access to all capabilities.

## Global Options

| Flag | Description |
|---|---|
| `--help`, `-h` | Show help |
| `--version`, `-v`, `-V` | Show version |

## Commands

### `ghx run <capability_id>`

Execute a single capability.

```bash
ghx run <capability_id> --input '<json>'
ghx run <capability_id> --input - < input.json
```

| Flag | Required | Description |
|---|---|---|
| `--input` | Yes | JSON object matching the capability's input schema. Use `-` for stdin |
| `--check-gh-preflight` | No | Check `gh` authentication before execution |
| `--verbose` | No | Emit diagnostic details on stderr |

**Examples:**

```bash
ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}'
ghx run repo.view --input - <<'EOF'
{"owner":"aryeko","name":"ghx"}
EOF
ghx run pr.view --input '{"owner":"acme","name":"repo","prNumber":42}'
ghx run issue.create --input '{"owner":"acme","name":"repo","title":"Bug report","body":"Details..."}'
```

**Output:** A JSON [`ResultEnvelope`](../concepts/result-envelope.md).

---

### `ghx chain`

Execute multiple capabilities as a batch.

```bash
ghx chain --steps '<json_array>'
ghx chain --steps - < steps.json    # read from stdin
```

| Flag | Required | Description |
|---|---|---|
| `--steps` | Yes | JSON array of `{task, input}` objects. Use `-` for stdin |
| `--check-gh-preflight` | No | Check `gh` authentication before execution |
| `--verbose` | No | Emit diagnostic details on stderr |

**Example:**

```bash
ghx chain --steps '[
  {"task":"issue.labels.remove","input":{"owner":"acme","name":"repo","issueNumber":7,"labels":["triage"]}},
  {"task":"issue.labels.add","input":{"owner":"acme","name":"repo","issueNumber":7,"labels":["bug"]}}
]'
```

**Output:** A JSON `ChainResultEnvelope`.

---

### `ghx capabilities list`

List all available capabilities.

```bash
ghx capabilities list [--domain <domain>]
```

| Flag | Required | Description |
|---|---|---|
| `--domain` | No | Filter by domain (e.g. `issue`, `pr`, `workflow`, `release`, `project_v2`, `repo`) |
| `--json` | No | Print the capability list as JSON |
| `--compact` | No | Print a compact agent-friendly list |

**Example:**

```bash
ghx capabilities list
ghx capabilities list --domain pr
ghx capabilities list --domain pr --compact
```

---

### `ghx capabilities explain <capability_id>`

Show detailed information about a capability.

```bash
ghx capabilities explain <capability_id> [--json]
```

| Flag | Required | Description |
|---|---|---|
| `--json` | No | Print the full capability card as JSON |

**Example:**

```bash
ghx capabilities explain pr.threads.list
ghx capabilities explain pr.reactions.list --json
```

**Output:** Capability description, input schema, output schema, routing config, examples.

---

### `ghx setup`

Install the ghx skill file for agent integration.

```bash
ghx setup --scope <project|user> [--yes] [--dry-run] [--verify] [--track]
```

| Flag | Required | Description |
|---|---|---|
| `--scope` | Yes | `project` (writes to `.agents/skills/using-ghx/SKILL.md`) or `user` (writes to `~/.agents/skills/using-ghx/SKILL.md`) |
| `--yes` | No | Skip confirmation prompt |
| `--dry-run` | No | Print the target path without writing files |
| `--verify` | No | Verify the installed skill exists and matches the packaged skill |
| `--track` | No | Write a local setup telemetry event |

**Example:**

```bash
ghx setup --scope project --yes
ghx setup --scope project --dry-run
ghx setup --scope project --verify
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GITHUB_TOKEN` / `GH_TOKEN` | Yes | GitHub personal access token |
| `GITHUB_GRAPHQL_URL` | No | Override GraphQL endpoint URL |
| `GH_HOST` | No | GitHub Enterprise host (auto-derives GraphQL URL) |
| `GHX_LOG_LEVEL` | No | Log level: `debug`, `info` (default), `warn`, `error` |

## Exit Codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Execution error (result.ok === false) |
| `2` | Invalid arguments or usage error |

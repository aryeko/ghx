# CLI Reference

The `ghx` CLI provides command-line access to all capabilities.

## Global Options

| Flag | Description |
|---|---|
| `--help`, `-h` | Show help |
| `--version` | Show version |

## Commands

### `ghx run <capability_id>`

Execute a single capability.

```bash
ghx run <capability_id> --input '<json>'
```

| Flag | Required | Description |
|---|---|---|
| `--input`, `-i` | Yes | JSON input matching the capability's input schema |

**Examples:**

```bash
ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}'
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
| `--steps`, `-s` | Yes | JSON array of `{task, input}` objects. Use `-` for stdin |

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
| `--domain`, `-d` | No | Filter by domain (e.g. `issue`, `pr`, `workflow`, `release`, `project_v2`, `repo`) |

**Example:**

```bash
ghx capabilities list
ghx capabilities list --domain pr
```

---

### `ghx capabilities explain <capability_id>`

Show detailed information about a capability.

```bash
ghx capabilities explain <capability_id>
```

**Example:**

```bash
ghx capabilities explain pr.threads.list
```

**Output:** Capability description, input schema, output schema, routing config, examples.

---

### `ghx setup`

Install the ghx skill file for agent integration.

```bash
ghx setup --scope <project|user> [--yes] [--verify]
```

| Flag | Required | Description |
|---|---|---|
| `--scope` | Yes | `project` (writes to `.agents/skills/using-ghx/SKILL.md`) or `user` (writes to `~/.agents/skills/using-ghx/SKILL.md`) |
| `--yes` | No | Skip confirmation prompt |
| `--verify` | No | Verify the installation is correct |

**Example:**

```bash
ghx setup --scope project --yes
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

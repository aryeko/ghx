# Agent Setup

Wire ghx into your AI agent to give it deterministic, token-efficient GitHub operations.

## Install

All platforms require `@ghx-dev/core` installed globally so `ghx` is available in PATH:

```bash
npm i -g @ghx-dev/core
```

Then wire it into your agent using one of the methods below.

## Claude Code (Plugin Marketplace)

The easiest path for Claude Code users. Run these commands inside a Claude Code session:

```bash
/plugin marketplace add aryeko/ghx
/plugin install ghx@ghx-dev
```

This registers the ghx marketplace and installs the plugin. Claude Code loads the skill automatically -- no manual file management needed. Verify by starting a new session and asking Claude to perform a GitHub operation.

## Other Agents

Install the ghx skill to the standard agents directory:

```bash
ghx setup --scope user --yes

# Verify
ghx setup --scope user --verify
```

This writes `SKILL.md` to `~/.agents/skills/using-ghx/SKILL.md`.

You can also install project-scoped (writes to `.agents/skills/using-ghx/SKILL.md` in the current directory):

```bash
ghx setup --scope project --yes
```

### Platform compatibility

| Platform | `--scope user` | `--scope project` | Notes |
|---|---|---|---|
| Codex | Yes | Yes | Also reads `AGENTS.md` and `~/.codex/skills/` |
| Cline | Yes | Yes | Also reads `~/.cline/skills/` |
| Windsurf | Yes | Yes | Also reads `.windsurf/skills/` |
| OpenCode | Yes | Yes | Also reads `~/.config/opencode/skills/` |
| Cursor | No | Yes | User-level skills read from `~/.cursor/skills/` instead |
| Aider | No | No | Use `--read ~/.agents/skills/using-ghx/SKILL.md` flag |

## The Execute Tool Pattern

ghx provides `createExecuteTool` — a factory that wraps the execution engine into a tool shape your agent can call:

```ts
import {
  createExecuteTool,
  createGithubClientFromToken,
  executeTask,
  listCapabilities,
  explainCapability,
} from "@ghx-dev/core"

const token = process.env.GITHUB_TOKEN!
const githubClient = createGithubClientFromToken(token)

// Create the tool
const tool = createExecuteTool({
  executeTask: (request) => executeTask(request, { githubClient, githubToken: token }),
})

// Your agent can now:
// 1. Discover what's available
const capabilities = listCapabilities()

// 2. Understand a specific capability
const info = explainCapability("pr.threads.list")

// 3. Execute it
const result = await tool.execute("pr.threads.list", {
  owner: "acme",
  name: "repo",
  prNumber: 42,
})
```

## Integration Pattern

A typical agent integration looks like this:

```mermaid
flowchart LR
    A[Agent Loop] --> B{Need GitHub data?}
    B -->|Yes| C[listCapabilities / explainCapability]
    C --> D[executeTask or executeTasks]
    D --> E{result.ok?}
    E -->|Yes| F[Use result.data]
    E -->|No| G{result.error.retryable?}
    G -->|Yes| D
    G -->|No| H[Report error to user]
    F --> A
    H --> A
    B -->|No| A
```

### Key Design Points

1. **Never throws** — `executeTask` always returns a `ResultEnvelope`. Your agent doesn't need try/catch.
2. **Route-transparent** — the agent doesn't choose CLI vs GraphQL. ghx routes automatically.
3. **Schema-validated** — inputs are validated against the operation card schema before execution. Invalid input returns a `VALIDATION` error, not a crash.
4. **Retryable errors flagged** — check `result.error.retryable` to decide whether to retry.

## Security: Token Permissions

| Use case | Recommended permissions |
|---|---|
| Read-only (view, list) | `Metadata: read`, `Contents: read`, `Pull requests: read`, `Issues: read` |
| Issue management | Above + `Issues: write` |
| PR review & merge | Above + `Pull requests: write` |
| Workflow management | Above + `Actions: read/write` |
| Full agent | `repo` scope (classic PAT) or all above (fine-grained) |

> **Principle**: Start with least privilege. Grant writes only for capabilities the agent actually uses.

## Next Steps

- [Concepts: How ghx Works](../concepts/README.md) — understand the internals
- [Error Handling Guide](../guides/error-handling.md) — build resilient agent flows
- [Capabilities Reference](../reference/capabilities.md) — browse all 70+ capabilities

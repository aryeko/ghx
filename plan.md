# Plan: Add GitHub MCP Server to Benchmarks

## Summary

Wire up the [remote GitHub MCP server](https://api.githubcopilot.com/mcp/) so that when the benchmark runs in `mcp` mode, the OpenCode agent has real GitHub MCP tools available — instead of the current placeholder where `mcp: {}` is passed and the agent only gets a vague "prefer MCP tools" instruction with no actual MCP server configured.

**Approach:** Use the remote GitHub MCP endpoint (`https://api.githubcopilot.com/mcp/`) with PAT auth via the `GH_TOKEN` / `GITHUB_TOKEN` already resolved in `client-setup.ts`. All toolsets enabled.

---

## Changes

### 1. `packages/benchmark/src/provider/opencode/client-setup.ts` — Wire MCP config

**What:** When `mode === "mcp"`, populate the `mcp` field in `createOpencode()` with a remote GitHub MCP server configuration.

**Detail:**
- Extract a helper function `buildMcpConfig(mode, ghToken)` that returns the MCP config object
- For `mcp` mode: return `{ "github": { type: "remote", url: "https://api.githubcopilot.com/mcp/", headers: { Authorization: "Bearer <token>" } } }`
- For `agent_direct` / `ghx` modes: return `{}` (unchanged)
- Allow URL override via `BENCH_MCP_SERVER_URL` env var (default: `https://api.githubcopilot.com/mcp/`)
- Require `ghToken` to be non-null when mode is `mcp`; throw a descriptive error if missing

**Code sketch:**
```typescript
const GITHUB_MCP_DEFAULT_URL = "https://api.githubcopilot.com/mcp/"

function buildMcpConfig(
  mode: BenchmarkMode,
  ghToken: string | null,
): Record<string, unknown> {
  if (mode !== "mcp") {
    return {}
  }

  if (!ghToken) {
    throw new Error(
      "benchmark_mcp_token_missing: mcp mode requires a GitHub token (GH_TOKEN, GITHUB_TOKEN, or gh auth token)",
    )
  }

  const url = process.env.BENCH_MCP_SERVER_URL ?? GITHUB_MCP_DEFAULT_URL

  return {
    github: {
      type: "remote",
      url,
      headers: {
        Authorization: `Bearer ${ghToken}`,
      },
    },
  }
}
```

Then pass `mcp: buildMcpConfig(mode, ghToken)` to `createOpencode()` (replacing the current `mcp: {}`).

Also remove the existing plugin-count validation guard or adjust it — MCP servers may register plugins/tools that show up in the config response.

### 2. `packages/benchmark/src/runner/mode-instructions.ts` — Improve MCP instruction

**What:** Update `MCP_INSTRUCTION` to be more specific about using GitHub MCP tools.

**Detail:**
```typescript
export const MCP_INSTRUCTION =
  "You have a GitHub MCP server connected. Use the MCP tools (e.g. create_issue, get_pull_request, list_commits) to complete GitHub tasks. Do not shell out to the `gh` CLI when an equivalent MCP tool is available."
```

This gives the agent clearer guidance on what tools it has and that it should prefer them over `gh` CLI.

### 3. `packages/benchmark/src/provider/opencode/client-setup.ts` — Adjust plugin validation

**What:** The current code validates `configuredPlugins.length > 0` throws an error. When MCP mode is active, the GitHub MCP server will register tools. We need to either:
- Skip the plugin validation when `mode === "mcp"` (the MCP server's tools aren't "plugins" in OpenCode's sense, but we should verify this), OR
- Pass `mode` into the validation block and adjust accordingly

Likely the MCP tools won't appear as `plugin` entries — they are MCP tools, separate from plugins. If so, no change needed. But we should verify in testing and handle if necessary.

### 4. Tests

#### 4a. `packages/benchmark/test/unit/provider/opencode/client-setup.test.ts`

Add tests:
- `it("passes GitHub MCP server config to createOpencode when mode is 'mcp'")` — verify `createOpencodeMock` receives `mcp.github` with `type: "remote"`, correct URL, and auth header
- `it("passes empty mcp config when mode is 'agent_direct'")` — verify `mcp: {}`
- `it("passes empty mcp config when mode is 'ghx'")` — verify `mcp: {}`
- `it("throws benchmark_mcp_token_missing when mode is 'mcp' and no token available")` — mock `spawnSync` to return failure, clear `GH_TOKEN`/`GITHUB_TOKEN`, expect error
- `it("uses BENCH_MCP_SERVER_URL override for mcp mode")` — set env var, verify URL passed

#### 4b. `packages/benchmark/test/unit/runner/mode-instructions.test.ts`

Update the `MCP_INSTRUCTION` exact-string test to match the new instruction text.

### 5. Documentation

#### 5a. `docs/benchmark/methodology.md`

Add a note under "Modes" section:
```markdown
- `mcp` — connects the [remote GitHub MCP server](https://api.githubcopilot.com/mcp/) via PAT auth; all toolsets enabled
```

#### 5b. CLAUDE.md

Add to the "Benchmark CLI flags" section:
```markdown
- `BENCH_MCP_SERVER_URL` — override remote MCP server URL (default: `https://api.githubcopilot.com/mcp/`)
```

---

## Files Changed

| File | Change |
|---|---|
| `packages/benchmark/src/provider/opencode/client-setup.ts` | Add `buildMcpConfig()`, pass to `createOpencode()`, add token validation for MCP mode |
| `packages/benchmark/src/runner/mode-instructions.ts` | Update `MCP_INSTRUCTION` text |
| `packages/benchmark/test/unit/provider/opencode/client-setup.test.ts` | Add 5 new test cases |
| `packages/benchmark/test/unit/runner/mode-instructions.test.ts` | Update instruction string assertion |
| `docs/benchmark/methodology.md` | Document MCP mode details |
| `CLAUDE.md` | Document `BENCH_MCP_SERVER_URL` env var |

---

## What Doesn't Change

- `BenchmarkMode` type — `"mcp"` already exists
- CLI arg parsing — `mcp` already accepted as a valid mode
- Report/aggregation — already handles `mcp` mode rows
- `agent_direct` / `ghx` modes — completely unaffected (still pass `mcp: {}`)
- Scenario definitions — mode is orthogonal to scenarios

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Remote MCP server availability | It's GitHub's hosted service; high uptime. Add `BENCH_MCP_SERVER_URL` override for fallback to local server |
| PAT scope insufficient | Document required PAT scopes in methodology docs |
| MCP server startup latency in benchmark | Remote server has no cold-start; negligible overhead vs Docker |
| OpenCode SDK may not support remote MCP type | Verify with a quick integration smoke test after implementation; fall back to local Docker config if needed |
| Token leak in logs | Token is passed via headers in config, not in command args or env logging |

## Open Questions

1. **OpenCode SDK remote MCP type support**: Need to verify the SDK's `createOpencode()` actually supports `type: "remote"` in the `mcp` config. If not, we may need to use `type: "local"` with Docker as fallback. A quick spike should confirm.
2. **Plugin validation**: Does the MCP server's tool registration affect the `configuredPlugins.length` check? Likely not (MCP tools != plugins) but should verify.

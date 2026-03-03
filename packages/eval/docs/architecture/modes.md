# Evaluation Modes

Modes define how the AI agent interacts with GitHub. Each mode configures a different toolset and instructions, creating controlled conditions for comparison. The three modes -- `ghx`, `mcp`, and `baseline` -- represent the primary question the eval framework answers: does structured capability routing (ghx) outperform alternative approaches?

## Mode Comparison Matrix

| Aspect | ghx | mcp | baseline |
|--------|-----|-----|----------|
| Tool call style | `ghx run <cap> --input '{}'` | MCP tool calls | `gh <cmd> --flag` |
| Output format | Structured JSON (normalized) | Structured JSON (MCP) | Text or JSON (varies) |
| Parsing required | No | No | Yes (agent must parse) |
| Capability discovery | SKILL.md (static) | MCP tool listing (dynamic) | Agent must know CLI |
| Error handling | Structured error codes | MCP error responses | Exit codes + stderr |
| Token overhead | Low (structured I/O) | Moderate | High (parsing, retries) |

## Mode Interaction Sequences

```mermaid
sequenceDiagram
  participant Agent
  participant ghx as ghx CLI
  participant GitHub as GitHub API

  Note over Agent,GitHub: ghx Mode (1 capability call)
  Agent->>ghx: ghx run pr.reviews.list --input '{...}'
  ghx->>GitHub: GraphQL query
  GitHub-->>ghx: Structured response
  ghx-->>Agent: ResultEnvelope { ok, data }

  Note over Agent,GitHub: Baseline Mode (multiple calls + parsing)
  Agent->>GitHub: gh pr view 42 --json reviews
  GitHub-->>Agent: JSON text
  Agent->>Agent: Parse JSON, extract fields
  Agent->>GitHub: gh api /repos/.../pulls/42/comments
  GitHub-->>Agent: JSON text
  Agent->>Agent: Parse, filter, aggregate
```

In ghx mode, the agent makes a single capability call and receives a normalized `ResultEnvelope`. In baseline mode, the same task may require multiple `gh` CLI invocations, manual JSON parsing, and result aggregation -- consuming more tokens and introducing more opportunities for error.

## EvalModeResolver

`EvalModeResolver` implements the profiler's `ModeResolver` contract. It maps each mode name to a `ModeConfig` containing environment variables, system instructions, and provider overrides:

```typescript
export class EvalModeResolver implements ModeResolver {
  async resolve(mode: string): Promise<ModeConfig> {
    switch (mode) {
      case "ghx":
        return {
          environment: {
            PATH: `${this.ghxBinDir()}:${process.env["PATH"] ?? ""}`,
          },
          systemInstructions: await this.loadSkillMd(),
          providerOverrides: {},
        }

      case "mcp":
        return {
          environment: {},
          systemInstructions: MCP_INSTRUCTIONS,
          providerOverrides: {},
        }

      case "baseline":
        return {
          environment: {},
          systemInstructions: BASELINE_INSTRUCTIONS,
          providerOverrides: {},
        }

      default:
        throw new Error(`Unknown mode: ${mode}`)
    }
  }
}
```

### ghx Mode

- **Environment:** Prepends the ghx binary directory to `PATH` so the agent can invoke `ghx run <capability>` directly.
- **System instructions:** Loads the full `SKILL.md` file, which documents every available capability with input/output schemas and examples. The resolver searches three locations in order: `GHX_SKILL_MD` environment variable, `./SKILL.md` in the working directory, and `~/.agents/skills/ghx/SKILL.md`. Falls back to a minimal instruction string if none are found.
- **Provider overrides:** None -- ghx operates as a CLI tool, not an MCP server.

### mcp Mode

- **Environment:** No PATH changes -- the GitHub MCP server is configured as a provider override.
- **System instructions:** Generic instructions describing available MCP tool categories (pull requests, issues, repositories, reviews, branches) and advising the agent to use the tool listing for discovery.
- **Provider overrides:** None -- the MCP server connection is handled at the provider level. The agent accesses GitHub MCP tools without a local subprocess.

### baseline Mode

- **Environment:** No modifications -- the agent uses whatever `gh` CLI is already on the PATH.
- **System instructions:** Minimal instructions listing common `gh` commands (`gh pr view`, `gh pr list`, `gh api graphql`, `gh issue view`) and advising the agent to use `--json` for structured output.
- **Provider overrides:** None -- the agent interacts with GitHub entirely through shell commands.

## System Instructions per Mode

Each mode's system instructions are calibrated to give the agent the right level of guidance for its toolset:

- **ghx:** Complete capability reference (SKILL.md) with input schemas, output shapes, and usage examples. The agent knows exactly what to call and what to expect back.
- **mcp:** Category-level guidance (PRs, issues, repos, reviews, branches) without specific tool names. The agent discovers available tools via the MCP tool listing protocol.
- **baseline:** Command-level examples (`gh pr view`, `gh api`) with a hint to use `--json`. The agent must know CLI syntax and parse output.

## Mode Execution Order and Provider Lifecycle

Modes run sequentially within a model. Each mode gets its own isolated provider lifecycle:

1. For model M, iterate over each mode:
   - `provider.init(modeConfig)` -- starts a fresh OpenCode server with the mode's environment variables and configuration
   - Run warmup canary (once per mode, absorbs per-mode startup overhead)
   - Execute all scenarios × repetitions
   - `provider.shutdown()` -- closes the server and cleans up temporary directories
2. Repeat for the next mode with a fresh `init()`/`shutdown()` cycle

This per-mode isolation means:
- Environment variables from one mode cannot bleed into another
- Each mode's PATH changes, system instructions, and provider config are applied in a clean context
- Warmup runs once per mode rather than once globally, ensuring startup costs are absorbed for every mode

The `modeConfig.environment` from `EvalModeResolver.resolve()` is passed directly to `provider.init()`, which applies it before starting the OpenCode server.

**Source:** `packages/eval/src/mode/resolver.ts`, `packages/eval/src/mode/definitions.ts`

## Related Documentation

- [Thesis](../methodology/thesis.md)
- [System Overview](./overview.md)
- [Plugin Implementations](./plugin-implementations.md)
- [OpenCode Provider](./opencode-provider.md)

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import type { ModeConfig, ModeResolver } from "@ghx-dev/agent-profiler"
import { BASELINE_INSTRUCTIONS, GHX_SKILL_FALLBACK, MCP_INSTRUCTIONS } from "./definitions.js"

/**
 * Mode resolver for the three ghx evaluation modes.
 *
 * | Mode       | What the agent gets                                         |
 * |------------|-------------------------------------------------------------|
 * | `ghx`      | ghx binary in PATH + SKILL.md injected as system prompt     |
 * | `mcp`      | GitHub MCP tools (always-on) + MCP_INSTRUCTIONS             |
 * | `baseline` | Plain `gh` CLI instructions only (control group)            |
 *
 * Implements `ModeResolver` from `@ghx-dev/agent-profiler`.
 *
 * @example
 * ```typescript
 * import { EvalModeResolver } from "@ghx-dev/eval"
 *
 * const resolver = new EvalModeResolver()
 * const config = await resolver.resolve("ghx")
 * // config.systemInstructions: full SKILL.md content
 * // config.environment: { PATH: "<ghx-bin>:..." }
 * ```
 */
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

  private ghxBinDir(): string {
    return process.env["GHX_BIN_DIR"] ?? join(process.cwd(), "node_modules", ".bin")
  }

  private async loadSkillMd(): Promise<string> {
    const candidates = [
      process.env["GHX_SKILL_MD"],
      join(process.cwd(), "SKILL.md"),
      join(process.env["HOME"] ?? "", ".agents", "skills", "ghx", "SKILL.md"),
      // SKILL.md shipped with the installed @ghx-dev/core package (adjacent to the ghx binary)
      join(
        this.ghxBinDir(),
        "..",
        "node_modules",
        "@ghx-dev",
        "core",
        "skills",
        "using-ghx",
        "SKILL.md",
      ),
      join(this.ghxBinDir(), "..", "@ghx-dev", "core", "skills", "using-ghx", "SKILL.md"),
    ].filter((p): p is string => p !== undefined && p !== "")

    for (const path of candidates) {
      try {
        return await readFile(path, "utf-8")
      } catch {
        // Try next candidate
      }
    }

    return GHX_SKILL_FALLBACK
  }
}

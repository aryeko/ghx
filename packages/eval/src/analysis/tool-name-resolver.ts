import { resolveToolDisplayName } from "@ghx-dev/agent-profiler"

const BASH_TOOL_NAMES = new Set(["bash", "shell", "terminal", "execute_command", "run_command"])

function isBashLikeTool(name: string): boolean {
  return BASH_TOOL_NAMES.has(name.toLowerCase())
}

function extractCommand(input: unknown): string | undefined {
  if (typeof input === "string") return input
  if (typeof input !== "object" || input === null) return undefined
  const record = input as Record<string, unknown>
  const raw = record["command"] ?? record["cmd"] ?? record["input"]
  return typeof raw === "string" ? raw : undefined
}

/**
 * Eval-specific tool name resolver that enriches bash tool calls with
 * ghx capability names and gh subcommands.
 *
 * - `ghx run <capability>` -> `ghx:<capability>`
 * - `gh api <path>` -> `gh api`
 * - `gh <subcommand>` -> `gh <subcommand>`
 * - Everything else delegates to the generic resolveToolDisplayName.
 */
export function resolveEvalToolName(name: string, input: unknown): string {
  if (!isBashLikeTool(name)) return name
  const command = extractCommand(input)
  if (!command) return name

  // ghx run <capability> -> ghx:<capability>
  const ghxMatch = command.match(/ghx\s+run\s+(\S+)/)
  if (ghxMatch?.[1]) return `ghx:${ghxMatch[1]}`

  // Fall back to generic enrichment for everything else
  return resolveToolDisplayName(name, input)
}

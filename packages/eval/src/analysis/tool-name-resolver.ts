import { extractCommand, isBashLikeTool, resolveToolDisplayName } from "@ghx-dev/agent-profiler"

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

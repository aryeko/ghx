import type { Analyzer } from "@profiler/contracts/analyzer.js"
import type { BaseScenario } from "@profiler/types/scenario.js"
import type { AnalysisResult, SessionTrace, TraceEvent } from "@profiler/types/trace.js"
import { isToolCall } from "./utils.js"

export const BASH_TOOL_NAMES: ReadonlySet<string> = new Set([
  "bash",
  "shell",
  "terminal",
  "execute_command",
  "run_command",
])

const SUBCOMMAND_PROGRAMS = new Set(["gh", "ghx", "git", "docker", "kubectl", "npm", "npx", "pnpm"])

export function isBashLikeTool(name: string): boolean {
  return BASH_TOOL_NAMES.has(name.toLowerCase())
}

export function extractCommand(input: unknown): string | undefined {
  if (typeof input === "string") return input
  if (typeof input !== "object" || input === null) return undefined
  const record = input as Record<string, unknown>
  const raw = record["command"] ?? record["cmd"] ?? record["input"]
  return typeof raw === "string" ? raw : undefined
}

function extractProgram(command: string): string | undefined {
  const trimmed = command.trim()
  if (trimmed === "") return undefined

  // Strip leading env vars (FOO=bar BAR=baz gh ...)
  // Note: \S+=\S+ does not handle values containing spaces (e.g. FOO="bar baz")
  const withoutEnvVars = trimmed.replace(/^(?:\S+=\S+\s+)+/, "")

  // Split into tokens
  const tokens = withoutEnvVars.split(/\s+/)
  const first = tokens[0]
  if (first === undefined || first === "") return undefined

  // Strip leading path (/usr/bin/gh -> gh)
  const program = first.replace(/^.*\//, "")

  // For programs that have meaningful subcommands, include the subcommand
  if (SUBCOMMAND_PROGRAMS.has(program)) {
    const sub = tokens[1]
    if (sub !== undefined && sub !== "" && !sub.startsWith("-")) {
      return `${program} ${sub}`
    }
  }

  return program
}

/**
 * Resolves a human-readable tool display name from a raw tool call.
 *
 * For bash-like tools, extracts the program name (and subcommand where
 * applicable) from the command string. Returns the raw name for non-bash tools.
 */
export function resolveToolDisplayName(name: string, input: unknown): string {
  if (!isBashLikeTool(name)) return name
  const command = extractCommand(input)
  if (!command) return name
  return extractProgram(command) ?? name
}

export interface ToolPatternAnalyzerOptions {
  readonly resolveToolName?: (name: string, input: unknown) => string
}

/**
 * Creates a tool-pattern analyzer with an optional custom tool name resolver.
 *
 * The resolver transforms raw tool names (e.g. "bash") into more descriptive
 * display names (e.g. "gh api", "git push") for analysis output.
 */
export function createToolPatternAnalyzer(options?: ToolPatternAnalyzerOptions): Analyzer {
  const resolve = options?.resolveToolName ?? resolveToolDisplayName

  return {
    name: "tool-pattern",

    async analyze(
      trace: SessionTrace,
      _scenario: BaseScenario,
      _mode: string,
    ): Promise<AnalysisResult> {
      const toolCalls = trace.events.filter(isToolCall)
      const toolNames = toolCalls.map((tc) => resolve(tc.name, tc.input))
      const uniqueTools = new Set(toolNames)

      const bigrams = computeBigrams(toolNames)
      const bigramRows = [...bigrams.entries()].map(
        ([pattern, count]) => [pattern, String(count)] as const,
      )

      const redundant = computeRedundantCalls(toolCalls, resolve)
      const redundantRows = [...redundant.values()].map(
        (r) => [r.tool, r.inputHash, String(r.count)] as const,
      )

      const failedRetried = computeFailedThenRetried(toolCalls, resolve)
      const failedRetriedRows = [...failedRetried.entries()].map(
        ([tool, count]) => [tool, String(count)] as const,
      )

      return {
        analyzer: "tool-pattern",
        findings: {
          tool_sequence: {
            type: "list",
            values: toolNames,
          },
          unique_tools_used: {
            type: "number",
            value: uniqueTools.size,
            unit: "tools",
          },
          tool_call_patterns: {
            type: "table",
            headers: ["pattern", "count"],
            rows: bigramRows,
          },
          redundant_calls: {
            type: "table",
            headers: ["tool", "input_hash", "count"],
            rows: redundantRows,
          },
          failed_then_retried: {
            type: "table",
            headers: ["tool", "occurrences"],
            rows: failedRetriedRows,
          },
        },
        summary: `${toolCalls.length} tool calls, ${uniqueTools.size} unique tools, ${redundantRows.length} redundant patterns, ${failedRetriedRows.length} retry patterns`,
      }
    },
  }
}

function computeBigrams(toolNames: readonly string[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (let i = 0; i < toolNames.length - 1; i++) {
    const a = toolNames[i]
    const b = toolNames[i + 1]
    if (a === undefined || b === undefined) continue
    const key = `${a} -> ${b}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

function computeRedundantCalls(
  toolCalls: readonly Extract<TraceEvent, { readonly type: "tool_call" }>[],
  resolveToolName: (name: string, input: unknown) => string,
): ReadonlyMap<
  string,
  { readonly tool: string; readonly inputHash: string; readonly count: number }
> {
  const seen = new Map<
    string,
    { readonly tool: string; readonly inputHash: string; count: number }
  >()
  for (const tc of toolCalls) {
    const toolName = resolveToolName(tc.name, tc.input)
    const inputHash = JSON.stringify(tc.input)
    const key = `${toolName}::${inputHash}`
    const existing = seen.get(key)
    if (existing) {
      seen.set(key, { ...existing, count: existing.count + 1 })
    } else {
      seen.set(key, { tool: toolName, inputHash, count: 1 })
    }
  }
  const result = new Map<
    string,
    { readonly tool: string; readonly inputHash: string; readonly count: number }
  >()
  for (const [key, val] of seen) {
    if (val.count > 1) {
      result.set(key, val)
    }
  }
  return result
}

function computeFailedThenRetried(
  toolCalls: readonly Extract<TraceEvent, { readonly type: "tool_call" }>[],
  resolveToolName: (name: string, input: unknown) => string,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (let i = 0; i < toolCalls.length - 1; i++) {
    const current = toolCalls[i]
    const next = toolCalls[i + 1]
    if (!current || !next) continue
    const currentName = resolveToolName(current.name, current.input)
    const nextName = resolveToolName(next.name, next.input)
    if (!current.success && nextName === currentName) {
      counts.set(currentName, (counts.get(currentName) ?? 0) + 1)
    }
  }
  return counts
}

/**
 * Default tool-pattern analyzer using the built-in resolveToolDisplayName.
 *
 * Computes bigram frequencies of consecutive tool calls, detects redundant
 * invocations (same tool with identical input), and identifies failed-then-retried
 * patterns where the agent immediately retries a failing tool call.
 */
export const toolPatternAnalyzer: Analyzer = createToolPatternAnalyzer()

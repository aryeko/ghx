import {
  createToolPatternAnalyzer,
  resolveToolDisplayName,
  toolPatternAnalyzer,
} from "@profiler/analyzer/tool-pattern-analyzer.js"
import { describe, expect, it } from "vitest"
import { makeScenario, makeSessionTrace } from "../../helpers/factories.js"

const scenario = makeScenario()
const mode = "test"

describe("tool-pattern-analyzer", () => {
  it("handles empty trace without errors", async () => {
    const trace = makeSessionTrace({
      events: [],
      turns: [],
      summary: {
        totalTurns: 0,
        totalToolCalls: 0,
        totalTokens: {
          input: 0,
          output: 0,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
          active: 0,
        },
        totalDuration: 0,
      },
    })

    const result = await toolPatternAnalyzer.analyze(trace, scenario, mode)

    expect(result.analyzer).toBe("tool-pattern")
    expect(result.findings.tool_sequence).toEqual({ type: "list", values: [] })
    expect(result.findings.unique_tools_used).toEqual({ type: "number", value: 0, unit: "tools" })
    expect(result.findings.tool_call_patterns).toEqual({
      type: "table",
      headers: ["pattern", "count"],
      rows: [],
    })
    expect(result.findings.redundant_calls).toEqual({
      type: "table",
      headers: ["tool", "input_hash", "count"],
      rows: [],
    })
    expect(result.findings.failed_then_retried).toEqual({
      type: "table",
      headers: ["tool", "occurrences"],
      rows: [],
    })
  })

  it("computes tool sequence and unique tools", async () => {
    const trace = makeSessionTrace({
      events: [
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "f.ts",
          output: "code",
          durationMs: 30,
          success: true,
        },
        {
          type: "tool_call",
          name: "bash",
          input: "test",
          output: "pass",
          durationMs: 100,
          success: true,
        },
      ],
    })

    const result = await toolPatternAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.tool_sequence).toEqual({
      type: "list",
      values: ["ls", "read_file", "test"],
    })
    expect(result.findings.unique_tools_used).toEqual({
      type: "number",
      value: 3,
      unit: "tools",
    })
  })

  it("computes bigram patterns", async () => {
    const trace = makeSessionTrace({
      events: [
        {
          type: "tool_call",
          name: "bash",
          input: { command: "gh api /repos" },
          output: "",
          durationMs: 10,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "b",
          output: "",
          durationMs: 10,
          success: true,
        },
        {
          type: "tool_call",
          name: "bash",
          input: { command: "gh pr list" },
          output: "",
          durationMs: 10,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "d",
          output: "",
          durationMs: 10,
          success: true,
        },
      ],
    })

    const result = await toolPatternAnalyzer.analyze(trace, scenario, mode)
    const patterns = result.findings.tool_call_patterns
    expect(patterns).toBeDefined()
    expect(patterns).toHaveProperty("type", "table")
    const pTable = patterns as { type: "table"; rows: readonly (readonly string[])[] }
    expect(pTable.rows).toContainEqual(["gh api -> read_file", "1"])
    expect(pTable.rows).toContainEqual(["read_file -> gh pr", "1"])
    expect(pTable.rows).toContainEqual(["gh pr -> read_file", "1"])
  })

  it("detects redundant calls (same tool + same input)", async () => {
    const trace = makeSessionTrace({
      events: [
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "f.ts",
          output: "code",
          durationMs: 30,
          success: true,
        },
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
      ],
    })

    const result = await toolPatternAnalyzer.analyze(trace, scenario, mode)
    const redundant = result.findings.redundant_calls
    expect(redundant).toBeDefined()
    expect(redundant).toHaveProperty("type", "table")
    const rTable = redundant as { type: "table"; rows: readonly (readonly string[])[] }
    expect(rTable.rows).toHaveLength(1)
    const rRow = rTable.rows[0] as readonly string[]
    expect(rRow[0]).toBe("ls")
    expect(rRow[2]).toBe("3")
  })

  it("detects failed-then-retried patterns", async () => {
    const trace = makeSessionTrace({
      events: [
        {
          type: "tool_call",
          name: "bash",
          input: "test",
          output: "",
          durationMs: 50,
          success: false,
          error: "exit 1",
        },
        {
          type: "tool_call",
          name: "bash",
          input: "test",
          output: "pass",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "f.ts",
          output: "",
          durationMs: 30,
          success: false,
          error: "not found",
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "g.ts",
          output: "code",
          durationMs: 30,
          success: true,
        },
      ],
    })

    const result = await toolPatternAnalyzer.analyze(trace, scenario, mode)
    const retried = result.findings.failed_then_retried
    expect(retried).toBeDefined()
    expect(retried).toHaveProperty("type", "table")
    const rtTable = retried as { type: "table"; rows: readonly (readonly string[])[] }
    expect(rtTable.rows).toContainEqual(["test", "1"])
    expect(rtTable.rows).toContainEqual(["read_file", "1"])
  })

  it("handles multi-turn trace with mixed event types", async () => {
    const trace = makeSessionTrace({
      events: [
        { type: "reasoning", content: "thinking", durationMs: 50, tokenCount: 10 },
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        { type: "turn_boundary", turnNumber: 2, timestamp: "2026-01-01T00:01:00Z" },
        {
          type: "tool_call",
          name: "bash",
          input: "ls",
          output: "ok",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "write_file",
          input: "f.ts",
          output: "ok",
          durationMs: 30,
          success: true,
        },
      ],
    })

    const result = await toolPatternAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.tool_sequence).toEqual({
      type: "list",
      values: ["ls", "ls", "write_file"],
    })
    expect(result.findings.unique_tools_used).toEqual({
      type: "number",
      value: 2,
      unit: "tools",
    })
  })

  it("enriches bash tool names with command input as object", async () => {
    const trace = makeSessionTrace({
      events: [
        {
          type: "tool_call",
          name: "bash",
          input: { command: "gh api /repos/owner/repo/pulls" },
          output: "ok",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "bash",
          input: { command: "git push origin main" },
          output: "ok",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "f.ts",
          output: "code",
          durationMs: 30,
          success: true,
        },
      ],
    })

    const result = await toolPatternAnalyzer.analyze(trace, scenario, mode)

    expect(result.findings.tool_sequence).toEqual({
      type: "list",
      values: ["gh api", "git push", "read_file"],
    })
    expect(result.findings.unique_tools_used).toEqual({
      type: "number",
      value: 3,
      unit: "tools",
    })
  })
})

describe("resolveToolDisplayName", () => {
  it("returns raw name for non-bash tools", () => {
    expect(resolveToolDisplayName("read_file", "f.ts")).toBe("read_file")
    expect(resolveToolDisplayName("write_file", { path: "f.ts" })).toBe("write_file")
  })

  it("extracts program name from string input", () => {
    expect(resolveToolDisplayName("bash", "ls -la")).toBe("ls")
    expect(resolveToolDisplayName("bash", "curl https://example.com")).toBe("curl")
  })

  it("extracts program from object with command field", () => {
    expect(resolveToolDisplayName("bash", { command: "npm install" })).toBe("npm install")
  })

  it("extracts program from object with cmd field", () => {
    expect(resolveToolDisplayName("bash", { cmd: "docker build ." })).toBe("docker build")
  })

  it("extracts program from object with input field", () => {
    expect(resolveToolDisplayName("bash", { input: "echo hello" })).toBe("echo")
  })

  it("includes subcommand for gh, git, ghx, docker, kubectl", () => {
    expect(resolveToolDisplayName("bash", "gh api /repos")).toBe("gh api")
    expect(resolveToolDisplayName("bash", "gh pr list")).toBe("gh pr")
    expect(resolveToolDisplayName("bash", "git commit -m 'msg'")).toBe("git commit")
    expect(resolveToolDisplayName("bash", "ghx run pr-review-submit")).toBe("ghx run")
    expect(resolveToolDisplayName("bash", "docker compose up")).toBe("docker compose")
    expect(resolveToolDisplayName("bash", "kubectl get pods")).toBe("kubectl get")
  })

  it("strips leading env vars", () => {
    expect(resolveToolDisplayName("bash", "FOO=bar gh api /repos")).toBe("gh api")
    expect(resolveToolDisplayName("bash", "A=1 B=2 npm test")).toBe("npm test")
  })

  it("strips leading path from program", () => {
    expect(resolveToolDisplayName("bash", "/usr/bin/gh api /repos")).toBe("gh api")
    expect(resolveToolDisplayName("bash", "/usr/local/bin/git push")).toBe("git push")
  })

  it("recognizes alternate bash tool names", () => {
    expect(resolveToolDisplayName("shell", "ls")).toBe("ls")
    expect(resolveToolDisplayName("terminal", "gh pr list")).toBe("gh pr")
    expect(resolveToolDisplayName("execute_command", "git status")).toBe("git status")
    expect(resolveToolDisplayName("run_command", "curl -s url")).toBe("curl")
  })

  it("returns raw name when input is null/undefined/non-string", () => {
    expect(resolveToolDisplayName("bash", null)).toBe("bash")
    expect(resolveToolDisplayName("bash", undefined)).toBe("bash")
    expect(resolveToolDisplayName("bash", 42)).toBe("bash")
  })

  it("returns raw name when command is empty", () => {
    expect(resolveToolDisplayName("bash", "")).toBe("bash")
    expect(resolveToolDisplayName("bash", "   ")).toBe("bash")
    expect(resolveToolDisplayName("bash", { command: "" })).toBe("bash")
  })

  it("does not include flag-like subcommands", () => {
    expect(resolveToolDisplayName("bash", "gh --version")).toBe("gh")
    expect(resolveToolDisplayName("bash", "git -C /path log")).toBe("git")
  })
})

describe("createToolPatternAnalyzer", () => {
  it("accepts a custom resolveToolName function", async () => {
    const customResolver = (name: string, _input: unknown) =>
      name === "bash" ? "custom-tool" : name

    const analyzer = createToolPatternAnalyzer({ resolveToolName: customResolver })

    const trace = makeSessionTrace({
      events: [
        {
          type: "tool_call",
          name: "bash",
          input: { command: "gh api /repos" },
          output: "ok",
          durationMs: 50,
          success: true,
        },
        {
          type: "tool_call",
          name: "read_file",
          input: "f.ts",
          output: "code",
          durationMs: 30,
          success: true,
        },
      ],
    })

    const result = await analyzer.analyze(trace, scenario, mode)

    expect(result.findings.tool_sequence).toEqual({
      type: "list",
      values: ["custom-tool", "read_file"],
    })
  })

  it("uses default resolveToolDisplayName when no custom resolver provided", async () => {
    const analyzer = createToolPatternAnalyzer()

    const trace = makeSessionTrace({
      events: [
        {
          type: "tool_call",
          name: "bash",
          input: { command: "gh pr list" },
          output: "ok",
          durationMs: 50,
          success: true,
        },
      ],
    })

    const result = await analyzer.analyze(trace, scenario, mode)

    expect(result.findings.tool_sequence).toEqual({
      type: "list",
      values: ["gh pr"],
    })
  })
})

import { describe, expect, it, vi } from "vitest"

const executeTasksMock = vi.fn()

vi.mock("@core/core/routing/engine.js", () => ({
  executeTasks: (...args: unknown[]) => executeTasksMock(...args),
}))

vi.mock("@core/gql/github-client.js", () => ({
  createGithubClient: (transport: unknown) => transport,
}))

describe("chainCommand parsing", () => {
  it("parseChainFlags extracts inline --steps", async () => {
    const { parseChainFlags } = await import("@core/cli/commands/chain.js")

    const flags = parseChainFlags(["--steps", '[{"task":"issue.close","input":{"issueId":"I_1"}}]'])
    expect(flags.stepsSource).toEqual({
      raw: '[{"task":"issue.close","input":{"issueId":"I_1"}}]',
    })
    expect(flags.skipGhPreflight).toBe(true)
  })

  it("parseChainFlags detects --steps - for stdin", async () => {
    const { parseChainFlags } = await import("@core/cli/commands/chain.js")

    const flags = parseChainFlags(["--steps", "-"])
    expect(flags.stepsSource).toBe("stdin")
    expect(flags.skipGhPreflight).toBe(true)
  })

  it("parseChainFlags respects --check-gh-preflight", async () => {
    const { parseChainFlags } = await import("@core/cli/commands/chain.js")

    const flags = parseChainFlags([
      "--steps",
      '[{"task":"issue.close","input":{"issueId":"I_1"}}]',
      "--check-gh-preflight",
    ])
    expect(flags.skipGhPreflight).toBe(false)
  })

  it("chainCommand returns 0 on success status", async () => {
    executeTasksMock.mockResolvedValue({
      status: "success",
      results: [{ task: "issue.close", ok: true }],
      meta: { route_used: "graphql", total: 1, succeeded: 1, failed: 0 },
    })

    const { chainCommand } = await import("@core/cli/commands/chain.js")

    vi.stubEnv("GITHUB_TOKEN", "test-token")

    const exitCode = await chainCommand([
      "--steps",
      '[{"task":"issue.close","input":{"issueId":"I_1"}}]',
    ])

    expect(exitCode).toBe(0)
  })

  it("chainCommand returns 0 on partial status", async () => {
    executeTasksMock.mockResolvedValue({
      status: "partial",
      results: [
        { task: "issue.close", ok: true },
        {
          task: "issue.close",
          ok: false,
          error: { code: "UNKNOWN", message: "failed", retryable: false },
        },
      ],
      meta: { route_used: "graphql", total: 2, succeeded: 1, failed: 1 },
    })

    const { chainCommand } = await import("@core/cli/commands/chain.js")

    vi.stubEnv("GITHUB_TOKEN", "test-token")

    const exitCode = await chainCommand([
      "--steps",
      '[{"task":"issue.close","input":{"issueId":"I_1"}},{"task":"issue.close","input":{"issueId":"I_2"}}]',
    ])

    expect(exitCode).toBe(0)
  })

  it("chainCommand returns 1 on failed status", async () => {
    executeTasksMock.mockResolvedValue({
      status: "failed",
      results: [
        {
          task: "issue.close",
          ok: false,
          error: { code: "VALIDATION", message: "invalid", retryable: false },
        },
      ],
      meta: { route_used: "graphql", total: 1, succeeded: 0, failed: 1 },
    })

    const { chainCommand } = await import("@core/cli/commands/chain.js")

    vi.stubEnv("GITHUB_TOKEN", "test-token")

    const exitCode = await chainCommand([
      "--steps",
      '[{"task":"issue.close","input":{"issueId":"I_1"}}]',
    ])

    expect(exitCode).toBe(1)
  })

  it("chainCommand returns 1 when GITHUB_TOKEN missing", async () => {
    const { chainCommand } = await import("@core/cli/commands/chain.js")

    vi.stubEnv("GITHUB_TOKEN", undefined)
    vi.stubEnv("GH_TOKEN", undefined)

    await expect(
      chainCommand(["--steps", '[{"task":"issue.close","input":{"issueId":"I_1"}}]']),
    ).rejects.toThrow("Missing GITHUB_TOKEN or GH_TOKEN")
  })
})

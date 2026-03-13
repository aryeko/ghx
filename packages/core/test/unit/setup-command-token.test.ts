import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const resolveGithubTokenMock = vi.fn()

vi.mock("@core/core/auth/resolve-token.js", () => ({
  resolveGithubToken: (...args: unknown[]) => resolveGithubTokenMock(...args),
}))

import { setupCommand } from "@core/cli/commands/setup.js"

describe("setupCommand token resolution", () => {
  const originalHome = process.env.HOME
  let tempRoot = ""

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), "ghx-setup-token-"))
    process.env.HOME = tempRoot
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env.HOME = originalHome
    vi.restoreAllMocks()
  })

  it("prints cache message when token resolved from gh-cli", async () => {
    resolveGithubTokenMock.mockResolvedValue({ token: "gho_test", source: "gh-cli" })
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope", "user", "--yes"])

    expect(code).toBe(0)
    const output = stdout.mock.calls.map((call) => String(call[0])).join("")
    expect(output).toContain("GitHub token cached from gh CLI")
  })

  it("does not print cache message when token resolved from env", async () => {
    resolveGithubTokenMock.mockResolvedValue({ token: "gho_test", source: "env" })
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope", "user", "--yes"])

    expect(code).toBe(0)
    const output = stdout.mock.calls.map((call) => String(call[0])).join("")
    expect(output).not.toContain("GitHub token cached")
  })

  it("prints warning when token resolution fails", async () => {
    resolveGithubTokenMock.mockRejectedValue(new Error("no token found"))
    vi.spyOn(process.stdout, "write").mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await setupCommand(["--scope", "user", "--yes"])

    expect(code).toBe(0)
    const errOutput = stderr.mock.calls.map((call) => String(call[0])).join("")
    expect(errOutput).toContain("Warning: could not resolve GitHub token")
    expect(errOutput).toContain("no token found")
  })
})

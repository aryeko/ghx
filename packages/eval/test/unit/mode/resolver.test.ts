import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { EvalModeResolver } from "@eval/mode/resolver.js"
import { afterEach, describe, expect, it, vi } from "vitest"

describe("EvalModeResolver", () => {
  const resolver = new EvalModeResolver()

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("resolves ghx mode with PATH prepended", async () => {
    const config = await resolver.resolve("ghx")
    expect(config.environment["PATH"]).toBeDefined()
    expect(typeof config.environment["PATH"]).toBe("string")
    expect(config.providerOverrides).toEqual({})
  })

  it("ghx mode system instructions contain ghx", async () => {
    const config = await resolver.resolve("ghx")
    // Should contain either SKILL.md content or the fallback
    expect(config.systemInstructions.length).toBeGreaterThan(0)
  })

  it("resolves mcp mode with empty providerOverrides (MCP is always-on in provider)", async () => {
    const config = await resolver.resolve("mcp")
    expect(config.providerOverrides).toEqual({})
  })

  it("mcp mode system instructions reference MCP tools", async () => {
    const config = await resolver.resolve("mcp")
    expect(config.systemInstructions).toContain("MCP")
  })

  it("resolves baseline mode with empty environment", async () => {
    const config = await resolver.resolve("baseline")
    expect(config.environment).toEqual({})
    expect(config.providerOverrides).toEqual({})
  })

  it("baseline mode system instructions contain gh", async () => {
    const config = await resolver.resolve("baseline")
    expect(config.systemInstructions).toContain("gh")
  })

  it("throws for unknown mode", async () => {
    await expect(resolver.resolve("unknown-mode")).rejects.toThrow("Unknown mode: unknown-mode")
  })

  it("uses GHX_BIN_DIR env when set", async () => {
    vi.stubEnv("GHX_BIN_DIR", "/custom/bin")
    const config = await resolver.resolve("ghx")
    expect(config.environment["PATH"]).toMatch(/^\/custom\/bin:/)
  })

  it("uses GHX_SKILL_MD env when set", async () => {
    // Point to a non-existent file to trigger fallback — testing env var is read
    vi.stubEnv("GHX_SKILL_MD", "/nonexistent/SKILL.md")
    const config = await resolver.resolve("ghx")
    // Falls back to GHX_SKILL_FALLBACK content
    expect(config.systemInstructions).toContain("ghx")
  })

  it("prefers canonical github-ghx user skill over legacy paths", async () => {
    const home = mkdtempSync(join(tmpdir(), "ghx-resolver-home-"))
    writeSkill(home, "github-ghx", "canonical github-ghx skill")
    writeSkill(home, "using-ghx", "legacy using-ghx skill")
    writeSkill(home, "ghx", "historical ghx skill")
    vi.stubEnv("HOME", home)

    const config = await resolver.resolve("ghx")

    expect(config.systemInstructions).toBe("canonical github-ghx skill")
  })

  it("falls back to legacy using-ghx user skill when canonical skill is absent", async () => {
    const home = mkdtempSync(join(tmpdir(), "ghx-resolver-home-"))
    writeSkill(home, "using-ghx", "legacy using-ghx skill")
    writeSkill(home, "ghx", "historical ghx skill")
    vi.stubEnv("HOME", home)

    const config = await resolver.resolve("ghx")

    expect(config.systemInstructions).toBe("legacy using-ghx skill")
  })
})

function writeSkill(home: string, name: string, content: string): void {
  const dir = join(home, ".agents", "skills", name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, "SKILL.md"), content, "utf8")
}

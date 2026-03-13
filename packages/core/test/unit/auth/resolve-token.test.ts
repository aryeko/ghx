import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("node:fs/promises")
vi.mock("node:fs")

const mockRun = vi.fn()
vi.mock("@core/core/execution/cli/safe-runner.js", () => ({
  createSafeCliCommandRunner: () => ({ run: mockRun }),
}))

import * as fs from "node:fs"
import * as fsp from "node:fs/promises"
import { invalidateTokenCache, resolveGithubToken } from "@core/core/auth/resolve-token.js"

describe("resolveGithubToken", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("GITHUB_TOKEN", undefined)
    vi.stubEnv("GH_TOKEN", undefined)
    vi.stubEnv("GH_HOST", undefined)
    vi.stubEnv("XDG_CACHE_HOME", undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns GITHUB_TOKEN when set", async () => {
    vi.stubEnv("GITHUB_TOKEN", "ghp_abc123")
    const result = await resolveGithubToken()
    expect(result).toEqual({ token: "ghp_abc123", source: "env" })
  })

  it("trims whitespace from GITHUB_TOKEN", async () => {
    vi.stubEnv("GITHUB_TOKEN", "  ghp_abc123  \n")
    const result = await resolveGithubToken()
    expect(result).toEqual({ token: "ghp_abc123", source: "env" })
  })

  it("falls back to GH_TOKEN when GITHUB_TOKEN is unset", async () => {
    vi.stubEnv("GH_TOKEN", "gho_xyz789")
    const result = await resolveGithubToken()
    expect(result).toEqual({ token: "gho_xyz789", source: "env" })
  })

  it("skips empty GITHUB_TOKEN and uses GH_TOKEN", async () => {
    vi.stubEnv("GITHUB_TOKEN", "   ")
    vi.stubEnv("GH_TOKEN", "gho_xyz789")
    const result = await resolveGithubToken()
    expect(result).toEqual({ token: "gho_xyz789", source: "env" })
  })

  describe("cache resolution", () => {
    it("reads from cache file when env vars are unset and cache is fresh", async () => {
      const now = Date.now()
      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: now - 1000,
      } as fs.Stats)
      vi.mocked(fsp.readFile).mockResolvedValue("ghp_cached_token\n")

      const result = await resolveGithubToken()
      expect(result).toEqual({ token: "ghp_cached_token", source: "cache" })
    })

    it("ignores expired cache (mtime > 24h)", async () => {
      const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000
      vi.mocked(fs.statSync).mockReturnValue({
        mtimeMs: twentyFiveHoursAgo,
      } as fs.Stats)

      mockRun.mockResolvedValue({
        stdout: "ghp_fresh_token\n",
        stderr: "",
        exitCode: 0,
      })
      vi.mocked(fsp.mkdir).mockResolvedValue(undefined)
      vi.mocked(fsp.writeFile).mockResolvedValue()
      vi.mocked(fsp.rename).mockResolvedValue()

      const result = await resolveGithubToken()
      expect(result).toEqual({ token: "ghp_fresh_token", source: "gh-cli" })
    })

    it("uses hostname-specific cache files", async () => {
      vi.stubEnv("GH_HOST", "github.example.com")
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error("ENOENT")
      })
      mockRun.mockResolvedValue({
        stdout: "ghp_enterprise\n",
        stderr: "",
        exitCode: 0,
      })
      vi.mocked(fsp.mkdir).mockResolvedValue(undefined)
      vi.mocked(fsp.writeFile).mockResolvedValue()
      vi.mocked(fsp.rename).mockResolvedValue()

      await resolveGithubToken()

      expect(mockRun).toHaveBeenCalledWith(
        "gh",
        ["auth", "token", "--hostname", "github.example.com"],
        5000,
      )
    })

    it("respects XDG_CACHE_HOME for cache location", async () => {
      vi.stubEnv("XDG_CACHE_HOME", "/custom/cache")
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error("ENOENT")
      })
      mockRun.mockResolvedValue({
        stdout: "ghp_token\n",
        stderr: "",
        exitCode: 0,
      })
      vi.mocked(fsp.mkdir).mockResolvedValue(undefined)
      vi.mocked(fsp.writeFile).mockResolvedValue()
      vi.mocked(fsp.rename).mockResolvedValue()

      await resolveGithubToken()

      expect(fsp.mkdir).toHaveBeenCalledWith(
        expect.stringContaining("/custom/cache/ghx/tokens"),
        expect.any(Object),
      )
    })
  })

  describe("gh-cli resolution", () => {
    beforeEach(() => {
      vi.mocked(fs.statSync).mockImplementation(() => {
        throw new Error("ENOENT")
      })
    })

    it("shells out to gh auth token when no env var and no cache", async () => {
      mockRun.mockResolvedValue({
        stdout: "ghp_from_cli\n",
        stderr: "",
        exitCode: 0,
      })
      vi.mocked(fsp.mkdir).mockResolvedValue(undefined)
      vi.mocked(fsp.writeFile).mockResolvedValue()
      vi.mocked(fsp.rename).mockResolvedValue()

      const result = await resolveGithubToken()
      expect(result).toEqual({ token: "ghp_from_cli", source: "gh-cli" })
      expect(mockRun).toHaveBeenCalledWith("gh", ["auth", "token"], 5000)
    })

    it("writes cache file after resolving from gh-cli", async () => {
      mockRun.mockResolvedValue({
        stdout: "ghp_from_cli\n",
        stderr: "",
        exitCode: 0,
      })
      vi.mocked(fsp.mkdir).mockResolvedValue(undefined)
      vi.mocked(fsp.writeFile).mockResolvedValue()
      vi.mocked(fsp.rename).mockResolvedValue()

      await resolveGithubToken()

      expect(fsp.mkdir).toHaveBeenCalledWith(expect.stringContaining("ghx/tokens"), {
        recursive: true,
        mode: 0o700,
      })
      expect(fsp.writeFile).toHaveBeenCalledWith(expect.stringContaining(".tmp"), "ghp_from_cli", {
        mode: 0o600,
      })
      expect(fsp.rename).toHaveBeenCalled()
    })

    it("does not cache empty gh auth token output", async () => {
      mockRun.mockResolvedValue({
        stdout: "\n",
        stderr: "",
        exitCode: 0,
      })

      await expect(resolveGithubToken()).rejects.toThrow("GitHub token not found")
    })

    it("does not cache when gh auth token fails (exit code != 0)", async () => {
      mockRun.mockResolvedValue({
        stdout: "",
        stderr: "not logged in",
        exitCode: 1,
      })

      await expect(resolveGithubToken()).rejects.toThrow("GitHub token not found")
    })

    it("throws descriptive error when all sources fail", async () => {
      mockRun.mockResolvedValue({
        stdout: "",
        stderr: "not logged in",
        exitCode: 1,
      })

      await expect(resolveGithubToken()).rejects.toThrow(
        "GitHub token not found. Set GITHUB_TOKEN or GH_TOKEN environment variable, or authenticate with: gh auth login",
      )
    })
  })

  describe("invalidateTokenCache", () => {
    it("deletes cache file for current hostname", async () => {
      vi.mocked(fsp.unlink).mockResolvedValue()

      await invalidateTokenCache()

      expect(fsp.unlink).toHaveBeenCalledWith(expect.stringContaining("github.com"))
    })

    it("is a no-op if cache file does not exist", async () => {
      vi.mocked(fsp.unlink).mockRejectedValue(
        Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
      )

      await expect(invalidateTokenCache()).resolves.toBeUndefined()
    })
  })
})

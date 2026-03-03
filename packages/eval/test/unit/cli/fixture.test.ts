import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockScenarios = [
  {
    id: "pr-fix-001",
    fixture: { requires: ["pr_open", "issue_labeled"], repo: "o/r", bindings: {} },
  },
  {
    id: "pr-fix-002",
    fixture: { requires: ["pr_open"], repo: "o/r", bindings: {} },
  },
  {
    id: "pr-fix-003",
  },
]

vi.mock("@eval/fixture/manager.js", () => ({
  FixtureManager: vi.fn().mockImplementation(() => ({
    seed: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockResolvedValue({ ok: ["pr-fixture"], missing: [] }),
    cleanup: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock("@eval/config/loader.js", () => ({
  loadEvalConfig: vi.fn().mockReturnValue({
    scenarios: { set: undefined, ids: undefined },
  }),
}))

vi.mock("@eval/scenario/loader.js", () => ({
  loadEvalScenarios: vi.fn().mockResolvedValue(mockScenarios),
  loadScenarioSets: vi.fn().mockResolvedValue({ "my-set": ["pr-fix-001", "pr-fix-002"] }),
}))

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue("modes: [ghx]"),
}))

describe("fixture command", () => {
  let fixtureFn: (argv: readonly string[]) => Promise<void>
  let processExitSpy: ReturnType<typeof vi.spyOn>
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    vi.clearAllMocks()

    processExitSpy = vi.spyOn(process, "exit").mockImplementation((_code) => {
      throw new Error(`process.exit(${_code})`)
    })
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const mod = await import("@eval/cli/fixture.js")
    fixtureFn = mod.fixture
  })

  afterEach(() => {
    vi.clearAllMocks()
    processExitSpy.mockRestore()
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe("seed subcommand", () => {
    it("loads config and scenarios then calls seed(scenarios)", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")
      const { readFile } = await import("node:fs/promises")
      const { loadEvalConfig } = await import("@eval/config/loader.js")
      const { loadEvalScenarios } = await import("@eval/scenario/loader.js")

      await fixtureFn(["seed"])

      expect(readFile).toHaveBeenCalledWith("config/eval.config.yaml", "utf-8")
      expect(loadEvalConfig).toHaveBeenCalledWith("modes: [ghx]")
      expect(loadEvalScenarios).toHaveBeenCalledWith("scenarios", undefined)

      const lastInstance = vi.mocked(FixtureManager).mock.results.at(-1)?.value as {
        seed: ReturnType<typeof vi.fn>
      }
      expect(lastInstance.seed).toHaveBeenCalledWith(mockScenarios)
    })

    it("uses --config to override config path", async () => {
      const { readFile } = await import("node:fs/promises")

      await fixtureFn(["seed", "--config", "custom/config.yaml"])

      expect(readFile).toHaveBeenCalledWith("custom/config.yaml", "utf-8")
    })

    it("constructs FixtureManager with env default repo", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")

      await fixtureFn(["seed"])

      expect(FixtureManager).toHaveBeenCalled()
    })

    it("resolves scenario IDs from scenarios.set when ids is undefined", async () => {
      const { loadEvalConfig } = await import("@eval/config/loader.js")
      const { loadEvalScenarios, loadScenarioSets } = await import("@eval/scenario/loader.js")

      vi.mocked(loadEvalConfig).mockReturnValueOnce({
        scenarios: { set: "my-set", ids: undefined },
      } as never)

      await fixtureFn(["seed"])

      expect(loadScenarioSets).toHaveBeenCalled()
      expect(loadEvalScenarios).toHaveBeenCalledWith("scenarios", ["pr-fix-001", "pr-fix-002"])
    })

    it("throws when scenarios.set is not found in scenario-sets.json", async () => {
      const { loadEvalConfig } = await import("@eval/config/loader.js")
      const { loadScenarioSets } = await import("@eval/scenario/loader.js")

      vi.mocked(loadEvalConfig).mockReturnValueOnce({
        scenarios: { set: "nonexistent-set", ids: undefined },
      } as never)
      vi.mocked(loadScenarioSets).mockResolvedValueOnce({})

      await expect(fixtureFn(["seed"])).rejects.toThrow(
        'Scenario set "nonexistent-set" not found in scenario-sets.json',
      )
    })
  })

  describe("--seed-id flag", () => {
    it("passes --seed-id to FixtureManager constructor", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")

      await fixtureFn(["seed", "--seed-id", "run-42"])

      expect(FixtureManager).toHaveBeenCalledWith(expect.objectContaining({ seedId: "run-42" }))
    })

    it("defaults seedId to 'default' when --seed-id is not provided", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")

      await fixtureFn(["seed"])

      expect(FixtureManager).toHaveBeenCalledWith(expect.objectContaining({ seedId: "default" }))
    })
  })

  describe("--dry-run flag", () => {
    it("prints fixture requirements without calling seed", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")

      await fixtureFn(["seed", "--dry-run"])

      const lastInstance = vi.mocked(FixtureManager).mock.results.at(-1)?.value as {
        seed: ReturnType<typeof vi.fn>
      }
      expect(lastInstance.seed).not.toHaveBeenCalled()

      const output = consoleLogSpy.mock.calls.flat().join(" ")
      expect(output).toContain("pr_open")
      expect(output).toContain("issue_labeled")
    })
  })

  describe("status subcommand", () => {
    it("calls fixtureManager.status() and prints results", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")

      await fixtureFn(["status"])

      const lastInstance = vi.mocked(FixtureManager).mock.results.at(-1)?.value as {
        status: ReturnType<typeof vi.fn>
      }
      expect(lastInstance.status).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalled()
    })

    it("prints ok and missing counts from status", async () => {
      await fixtureFn(["status"])

      const calls = consoleLogSpy.mock.calls.flat().join(" ")
      expect(calls).toContain("pr-fixture")
    })

    it("prints missing fixtures when status has missing items", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")
      vi.mocked(FixtureManager).mockImplementationOnce(
        () =>
          ({
            seed: vi.fn().mockResolvedValue(undefined),
            status: vi.fn().mockResolvedValue({ ok: [], missing: ["missing-fixture"] }),
            cleanup: vi.fn().mockResolvedValue(undefined),
            reset: vi.fn().mockResolvedValue(undefined),
          }) as never,
      )

      await fixtureFn(["status"])

      const calls = consoleLogSpy.mock.calls.flat().join(" ")
      expect(calls).toContain("missing-fixture")
    })

    it("prints no fixtures found when status is empty", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")
      vi.mocked(FixtureManager).mockImplementationOnce(
        () =>
          ({
            seed: vi.fn().mockResolvedValue(undefined),
            status: vi.fn().mockResolvedValue({ ok: [], missing: [] }),
            cleanup: vi.fn().mockResolvedValue(undefined),
            reset: vi.fn().mockResolvedValue(undefined),
          }) as never,
      )

      await fixtureFn(["status"])

      const calls = consoleLogSpy.mock.calls.flat().join(" ")
      expect(calls).toContain("no fixtures found")
    })
  })

  describe("cleanup subcommand", () => {
    it("calls fixtureManager.cleanup()", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")

      await fixtureFn(["cleanup"])

      const lastInstance = vi.mocked(FixtureManager).mock.results.at(-1)?.value as {
        cleanup: ReturnType<typeof vi.fn>
      }
      expect(lastInstance.cleanup).toHaveBeenCalled()
    })

    it("passes all: true to cleanup when --all flag is present", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")

      await fixtureFn(["cleanup", "--all"])

      const lastInstance = vi.mocked(FixtureManager).mock.results.at(-1)?.value as {
        cleanup: ReturnType<typeof vi.fn>
      }
      expect(lastInstance.cleanup).toHaveBeenCalledWith({ all: true })
    })

    it("passes all: false to cleanup without --all flag", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")

      await fixtureFn(["cleanup"])

      const lastInstance = vi.mocked(FixtureManager).mock.results.at(-1)?.value as {
        cleanup: ReturnType<typeof vi.fn>
      }
      expect(lastInstance.cleanup).toHaveBeenCalledWith({ all: false })
    })
  })

  describe("--repo and --manifest flags", () => {
    it("constructs FixtureManager with specified --repo and --manifest", async () => {
      const { FixtureManager } = await import("@eval/fixture/manager.js")

      await fixtureFn(["status", "--repo", "owner/custom-repo", "--manifest", "custom/path.json"])

      expect(FixtureManager).toHaveBeenCalledWith(
        expect.objectContaining({
          repo: "owner/custom-repo",
          manifest: "custom/path.json",
        }),
      )
    })
  })

  describe("unknown subcommand", () => {
    it("exits 1 on unknown subcommand", async () => {
      await expect(fixtureFn(["unknown"])).rejects.toThrow()
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    it("prints usage and exits 1 when no subcommand given", async () => {
      await expect(fixtureFn([])).rejects.toThrow("process.exit(1)")

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })
})

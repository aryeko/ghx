import type { FixtureManager } from "@eval/fixture/manager.js"
import { createEvalHooks } from "@eval/hooks/eval-hooks.js"
import type { AfterScenarioContext, RunContext } from "@ghx-dev/agent-profiler"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock file system
vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}))

function makeFixtureManager(
  overrides?: Partial<{
    status: () => Promise<{ ok: readonly string[]; missing: readonly string[] }>
    reset: (requires: readonly string[]) => Promise<void>
    seedOne: (fixtureName: string) => Promise<unknown>
  }>,
): FixtureManager {
  return {
    status: vi.fn().mockResolvedValue({ ok: ["pr_with_mixed_threads"], missing: [] }),
    reset: vi.fn().mockResolvedValue(undefined),
    seed: vi.fn().mockResolvedValue(undefined),
    seedOne: vi.fn().mockResolvedValue({
      type: "pr",
      number: 999,
      repo: "aryeko/ghx-bench-fixtures",
      branch: "bench-fixture/pr_with_changes-1234",
      labels: ["@ghx-dev/eval"],
      metadata: { originalSha: "abc123" },
    }),
    cleanup: vi.fn().mockResolvedValue(undefined),
    closeResource: vi.fn().mockResolvedValue(undefined),
    deleteBranch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as FixtureManager
}

const dummyRunContext: RunContext = {
  runId: "run-123",
  modes: ["ghx"],
  scenarios: [],
  repetitions: 1,
}

describe("createEvalHooks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("beforeRun", () => {
    it("does not throw when all fixtures are present", async () => {
      const manager = makeFixtureManager()
      const { beforeRun } = createEvalHooks({ fixtureManager: manager, sessionExport: false })
      await expect(beforeRun?.(dummyRunContext)).resolves.toBeUndefined()
    })

    it("throws when fixtures are missing", async () => {
      const manager = makeFixtureManager({
        status: vi.fn().mockResolvedValue({ ok: [], missing: ["pr_with_mixed_threads"] }),
      })
      const { beforeRun } = createEvalHooks({ fixtureManager: manager, sessionExport: false })
      await expect(beforeRun?.(dummyRunContext)).rejects.toThrow(
        "Missing fixtures before run: pr_with_mixed_threads",
      )
    })
  })

  describe("beforeMode", () => {
    it("calls reset with fixtureRequires when reseedBetweenModes is true", async () => {
      const manager = makeFixtureManager()
      const { beforeMode } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
        reseedBetweenModes: true,
        fixtureRequires: ["pr_with_changes", "pr_with_mixed_threads"],
      })

      await beforeMode?.("ghx")

      expect(manager.reset).toHaveBeenCalledWith(["pr_with_changes", "pr_with_mixed_threads"])
    })

    it("does not call reset when reseedBetweenModes is false", async () => {
      const manager = makeFixtureManager()
      const { beforeMode } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
        reseedBetweenModes: false,
        fixtureRequires: ["pr_with_changes"],
      })

      await beforeMode?.("ghx")

      expect(manager.reset).not.toHaveBeenCalled()
    })

    it("does not call reset when fixtureRequires is empty", async () => {
      const manager = makeFixtureManager()
      const { beforeMode } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
        reseedBetweenModes: true,
        fixtureRequires: [],
      })

      await beforeMode?.("ghx")

      expect(manager.reset).not.toHaveBeenCalled()
    })

    it("does not call reset when fixtureRequires is omitted", async () => {
      const manager = makeFixtureManager()
      const { beforeMode } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
        reseedBetweenModes: true,
      })

      await beforeMode?.("ghx")

      expect(manager.reset).not.toHaveBeenCalled()
    })
  })

  describe("beforeScenario", () => {
    it("calls reset when reseedPerIteration is true", async () => {
      const manager = makeFixtureManager()
      const { beforeScenario } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
      })

      await beforeScenario?.({
        scenario: {
          id: "test-001",
          name: "test",
          description: "test",
          prompt: "test",
          timeoutMs: 60000,
          allowedRetries: 0,
          tags: [],
          category: "pr",
          difficulty: "basic",
          fixture: {
            repo: "aryeko/ghx-bench-fixtures",
            requires: ["pr_with_mixed_threads"],
            bindings: {},
            reseedPerIteration: true,
          },
          assertions: { checkpoints: [] },
        } as unknown as import("@ghx-dev/agent-profiler").BaseScenario,
        mode: "ghx",
        model: "test-model",
        iteration: 1,
      })

      expect(manager.reset).toHaveBeenCalledWith(["pr_with_mixed_threads"])
    })

    it("does not call reset when reseedPerIteration is false", async () => {
      const manager = makeFixtureManager()
      const { beforeScenario } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
      })

      await beforeScenario?.({
        scenario: {
          id: "test-001",
          name: "test",
          description: "test",
          prompt: "test",
          timeoutMs: 60000,
          allowedRetries: 0,
          tags: [],
          category: "pr",
          difficulty: "basic",
          fixture: {
            repo: "aryeko/ghx-bench-fixtures",
            requires: ["pr_with_mixed_threads"],
            bindings: {},
            reseedPerIteration: false,
          },
          assertions: { checkpoints: [] },
        } as unknown as import("@ghx-dev/agent-profiler").BaseScenario,
        mode: "ghx",
        model: "test-model",
        iteration: 1,
      })

      expect(manager.reset).not.toHaveBeenCalled()
    })

    it("does not call reset when scenario has no fixture", async () => {
      const manager = makeFixtureManager()
      const { beforeScenario } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
      })

      await beforeScenario?.({
        scenario: {
          id: "test-001",
          name: "test",
          description: "test",
          prompt: "test",
          timeoutMs: 60000,
          allowedRetries: 0,
          tags: [],
          category: "pr",
          difficulty: "basic",
          assertions: { checkpoints: [] },
        } as unknown as import("@ghx-dev/agent-profiler").BaseScenario,
        mode: "ghx",
        model: "test-model",
        iteration: 1,
      })

      expect(manager.reset).not.toHaveBeenCalled()
    })

    it("seeds new fixture and returns rebound scenario when seedPerIteration is true", async () => {
      const manager = makeFixtureManager()
      const rawScenario = {
        id: "test-seed-001",
        name: "test",
        description: "test",
        prompt: "Review PR #{{pr_number}} in {{repo}} run={{run_id}}",
        timeoutMs: 60000,
        allowedRetries: 0,
        tags: [],
        category: "pr" as const,
        difficulty: "basic" as const,
        fixture: {
          repo: "aryeko/ghx-bench-fixtures",
          requires: ["pr_with_changes"],
          bindings: { pr_number: "pr_with_changes.number", repo: "pr_with_changes.repo" },
          reseedPerIteration: false,
          seedPerIteration: true,
        },
        assertions: { checkpoints: [] },
      }
      const rawScenariosMap = new Map([
        [
          "test-seed-001",
          rawScenario as unknown as import("@eval/scenario/schema.js").EvalScenario,
        ],
      ])
      const { beforeScenario } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
        rawScenarios: rawScenariosMap,
        runId: "run_test_42",
      })

      const result = await beforeScenario?.({
        scenario: {
          ...rawScenario,
          prompt: "Review PR #372 in aryeko/ghx-bench-fixtures",
        } as unknown as import("@ghx-dev/agent-profiler").BaseScenario,
        mode: "ghx",
        model: "test-model",
        iteration: 0,
      })

      expect(manager.seedOne).toHaveBeenCalledWith("pr_with_changes")
      expect(result).toBeDefined()
      const reboundScenario = result as import("@ghx-dev/agent-profiler").BaseScenario
      expect(reboundScenario.prompt).toContain("999")
      expect(reboundScenario.prompt).not.toContain("372")
      expect(reboundScenario.prompt).toContain("run_test_42")
    })

    it("does not seed when seedPerIteration is false", async () => {
      const manager = makeFixtureManager()
      const { beforeScenario } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
      })

      await beforeScenario?.({
        scenario: {
          id: "test-001",
          name: "test",
          description: "test",
          prompt: "test",
          timeoutMs: 60000,
          allowedRetries: 0,
          tags: [],
          category: "pr",
          difficulty: "basic",
          fixture: {
            repo: "aryeko/ghx-bench-fixtures",
            requires: ["pr_with_changes"],
            bindings: {},
            reseedPerIteration: false,
            seedPerIteration: false,
          },
          assertions: { checkpoints: [] },
        } as unknown as import("@ghx-dev/agent-profiler").BaseScenario,
        mode: "ghx",
        model: "test-model",
        iteration: 0,
      })

      expect(manager.seedOne).not.toHaveBeenCalled()
    })

    it("returns undefined when seedPerIteration is true but rawScenarios has no entry for the scenario", async () => {
      const manager = makeFixtureManager()
      const { beforeScenario } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
        rawScenarios: new Map(), // empty — no entry for "test-001"
      })

      const result = await beforeScenario?.({
        scenario: {
          id: "test-001",
          name: "test",
          description: "test",
          prompt: "test",
          timeoutMs: 60000,
          allowedRetries: 0,
          tags: [],
          category: "pr",
          difficulty: "basic",
          fixture: {
            repo: "aryeko/ghx-bench-fixtures",
            requires: ["pr_with_changes"],
            bindings: {},
            reseedPerIteration: false,
            seedPerIteration: true,
          },
          assertions: { checkpoints: [] },
        } as unknown as import("@ghx-dev/agent-profiler").BaseScenario,
        mode: "ghx",
        model: "test-model",
        iteration: 0,
      })

      expect(result).toBeUndefined()
      expect(manager.seedOne).not.toHaveBeenCalled()
    })
  })

  describe("judgeProvider lifecycle", () => {
    it("calls judgeProvider.init() in beforeRun when provided", async () => {
      const manager = makeFixtureManager()
      const judgeProvider = {
        init: vi.fn().mockResolvedValue(undefined),
        shutdown: vi.fn().mockResolvedValue(undefined),
      }
      const { beforeRun } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
        judgeProvider,
      })
      await beforeRun?.(dummyRunContext)
      expect(judgeProvider.init).toHaveBeenCalledOnce()
    })

    it("calls judgeProvider.shutdown() in afterRun when provided", async () => {
      const manager = makeFixtureManager()
      const judgeProvider = {
        init: vi.fn().mockResolvedValue(undefined),
        shutdown: vi.fn().mockResolvedValue(undefined),
      }
      const { afterRun } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
        judgeProvider,
      })
      await afterRun?.(dummyRunContext)
      expect(judgeProvider.shutdown).toHaveBeenCalledOnce()
    })

    it("calls judgeProvider.shutdown() even if shutdown itself rejects", async () => {
      const manager = makeFixtureManager()
      const judgeProvider = {
        init: vi.fn().mockResolvedValue(undefined),
        shutdown: vi.fn().mockRejectedValue(new Error("shutdown failed")),
      }
      const { afterRun } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
        judgeProvider,
      })
      // shutdown rejection propagates — the important thing is shutdown was called
      await expect(afterRun?.(dummyRunContext)).rejects.toThrow("shutdown failed")
      expect(judgeProvider.shutdown).toHaveBeenCalledOnce()
    })

    it("does not set afterRun when no judgeProvider provided", () => {
      const manager = makeFixtureManager()
      const hooks = createEvalHooks({ fixtureManager: manager, sessionExport: false })
      expect(hooks.afterRun).toBeUndefined()
    })

    it("does not call judgeProvider.init() when fixtures are missing (beforeRun throws first)", async () => {
      const manager = makeFixtureManager({
        status: vi.fn().mockResolvedValue({ ok: [], missing: ["pr_with_mixed_threads"] }),
      })
      const judgeProvider = {
        init: vi.fn().mockResolvedValue(undefined),
        shutdown: vi.fn().mockResolvedValue(undefined),
      }
      const { beforeRun } = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
        judgeProvider,
      })
      await expect(beforeRun?.(dummyRunContext)).rejects.toThrow("Missing fixtures before run")
      expect(judgeProvider.init).not.toHaveBeenCalled()
    })
  })

  describe("afterScenario", () => {
    it("closes seeded resources after a seedPerIteration iteration", async () => {
      const manager = makeFixtureManager()
      const rawScenario = {
        id: "test-cleanup-001",
        name: "test",
        description: "test",
        prompt: "Review PR #{{pr_number}} in {{repo}}",
        timeoutMs: 60000,
        allowedRetries: 0,
        tags: [],
        category: "pr" as const,
        difficulty: "basic" as const,
        fixture: {
          repo: "aryeko/ghx-bench-fixtures",
          requires: ["pr_with_changes"],
          bindings: { pr_number: "pr_with_changes.number", repo: "pr_with_changes.repo" },
          reseedPerIteration: false,
          seedPerIteration: true,
        },
        assertions: { checkpoints: [] },
      }
      const rawScenariosMap = new Map([
        [
          "test-cleanup-001",
          rawScenario as unknown as import("@eval/scenario/schema.js").EvalScenario,
        ],
      ])
      const hooks = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
        rawScenarios: rawScenariosMap,
      })

      await hooks.beforeScenario?.({
        scenario: rawScenario as unknown as import("@ghx-dev/agent-profiler").BaseScenario,
        mode: "ghx",
        model: "test-model",
        iteration: 0,
      })

      await hooks.afterScenario?.({
        scenario: { id: "test-cleanup-001" } as never,
        mode: "ghx",
        model: "test-model",
        iteration: 0,
        result: {} as never,
        trace: null,
      } as import("@ghx-dev/agent-profiler").AfterScenarioContext)

      expect(manager.closeResource).toHaveBeenCalledWith(
        expect.objectContaining({ number: 999, repo: "aryeko/ghx-bench-fixtures" }),
      )
    })

    it("exports session trace when sessionExport is true and trace is available", async () => {
      const { writeFile, mkdir } = await import("node:fs/promises")
      const manager = makeFixtureManager()
      const { afterScenario } = createEvalHooks({ fixtureManager: manager, sessionExport: true })

      const dummyTrace = {
        sessionId: "ses-123",
        events: [],
        turns: [],
        summary: {
          totalTurns: 1,
          totalToolCalls: 0,
          totalTokens: {} as never,
          totalDuration: 0,
        },
      }

      await afterScenario?.({
        scenario: { id: "pr-fix-mixed-threads-001" } as never,
        mode: "ghx",
        model: "test-model",
        iteration: 1,
        result: {} as never,
        trace: dummyTrace,
      } as AfterScenarioContext)

      expect(mkdir).toHaveBeenCalled()
      expect(writeFile).toHaveBeenCalled()
    })

    it("does not export when sessionExport is false", async () => {
      const { writeFile } = await import("node:fs/promises")
      const manager = makeFixtureManager()
      const { afterScenario } = createEvalHooks({ fixtureManager: manager, sessionExport: false })

      await afterScenario?.({
        scenario: { id: "pr-fix-001" } as never,
        mode: "ghx",
        model: "test",
        iteration: 1,
        result: {} as never,
        trace: { sessionId: "s", events: [], turns: [], summary: {} as never },
      } as AfterScenarioContext)

      expect(writeFile).not.toHaveBeenCalled()
    })

    it("does not export when trace is null", async () => {
      const { writeFile } = await import("node:fs/promises")
      const manager = makeFixtureManager()
      const { afterScenario } = createEvalHooks({ fixtureManager: manager, sessionExport: true })

      await afterScenario?.({
        scenario: { id: "pr-fix-001" } as never,
        mode: "ghx",
        model: "test",
        iteration: 1,
        result: {} as never,
        trace: null,
      } as AfterScenarioContext)

      expect(writeFile).not.toHaveBeenCalled()
    })

    it("calls deleteBranch when resource has metadata.headBranch", async () => {
      const manager = makeFixtureManager()
      // Override seedOne to return a resource with metadata.headBranch
      vi.spyOn(manager, "seedOne").mockResolvedValue({
        type: "issue",
        number: 42,
        repo: "aryeko/ghx-bench-fixtures",
        branch: undefined,
        labels: ["@ghx-dev/eval"],
        metadata: { headBranch: "feat/issue-42-branch" },
      } as unknown as import("@eval/fixture/manifest.js").FixtureResource)

      const rawScenario = {
        id: "branch-cleanup-001",
        name: "test",
        description: "test",
        prompt: "Fix issue #{{issue_number}}",
        timeoutMs: 60000,
        allowedRetries: 0,
        tags: [],
        category: "issue" as const,
        difficulty: "basic" as const,
        fixture: {
          repo: "aryeko/ghx-bench-fixtures",
          requires: ["issue_with_branch"],
          bindings: { issue_number: "issue_with_branch.number" },
          reseedPerIteration: false,
          seedPerIteration: true,
        },
        assertions: { checkpoints: [] },
      }
      const rawScenariosMap = new Map([
        [
          "branch-cleanup-001",
          rawScenario as unknown as import("@eval/scenario/schema.js").EvalScenario,
        ],
      ])
      const hooks = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
        rawScenarios: rawScenariosMap,
      })

      await hooks.beforeScenario?.({
        scenario: rawScenario as unknown as import("@ghx-dev/agent-profiler").BaseScenario,
        mode: "ghx",
        model: "test-model",
        iteration: 0,
      })

      await hooks.afterScenario?.({
        scenario: { id: "branch-cleanup-001" } as never,
        mode: "ghx",
        model: "test-model",
        iteration: 0,
        result: {} as never,
        trace: null,
      } as import("@ghx-dev/agent-profiler").AfterScenarioContext)

      expect(manager.deleteBranch).toHaveBeenCalledWith(
        "aryeko/ghx-bench-fixtures",
        "feat/issue-42-branch",
      )
    })

    it("does not call deleteBranch when resource has no metadata.headBranch", async () => {
      const manager = makeFixtureManager()
      const rawScenario = {
        id: "no-branch-cleanup-001",
        name: "test",
        description: "test",
        prompt: "Review PR #{{pr_number}}",
        timeoutMs: 60000,
        allowedRetries: 0,
        tags: [],
        category: "pr" as const,
        difficulty: "basic" as const,
        fixture: {
          repo: "aryeko/ghx-bench-fixtures",
          requires: ["pr_with_changes"],
          bindings: { pr_number: "pr_with_changes.number", repo: "pr_with_changes.repo" },
          reseedPerIteration: false,
          seedPerIteration: true,
        },
        assertions: { checkpoints: [] },
      }
      const rawScenariosMap = new Map([
        [
          "no-branch-cleanup-001",
          rawScenario as unknown as import("@eval/scenario/schema.js").EvalScenario,
        ],
      ])
      const hooks = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
        rawScenarios: rawScenariosMap,
      })

      await hooks.beforeScenario?.({
        scenario: rawScenario as unknown as import("@ghx-dev/agent-profiler").BaseScenario,
        mode: "ghx",
        model: "test-model",
        iteration: 0,
      })

      await hooks.afterScenario?.({
        scenario: { id: "no-branch-cleanup-001" } as never,
        mode: "ghx",
        model: "test-model",
        iteration: 0,
        result: {} as never,
        trace: null,
      } as import("@ghx-dev/agent-profiler").AfterScenarioContext)

      // seedOne returns metadata without headBranch, so deleteBranch should not be called
      expect(manager.deleteBranch).not.toHaveBeenCalled()
    })

    it("does not throw when closeResource fails during cleanup (best-effort)", async () => {
      const manager = makeFixtureManager()
      vi.spyOn(manager, "closeResource").mockRejectedValue(new Error("gh: resource closed"))

      const rawScenario = {
        id: "cleanup-err-001",
        name: "test",
        description: "test",
        prompt: "Review PR #{{pr_number}} in {{repo}}",
        timeoutMs: 60000,
        allowedRetries: 0,
        tags: [],
        category: "pr" as const,
        difficulty: "basic" as const,
        fixture: {
          repo: "aryeko/ghx-bench-fixtures",
          requires: ["pr_with_changes"],
          bindings: { pr_number: "pr_with_changes.number", repo: "pr_with_changes.repo" },
          reseedPerIteration: false,
          seedPerIteration: true,
        },
        assertions: { checkpoints: [] },
      }
      const rawScenariosMap = new Map([
        [
          "cleanup-err-001",
          rawScenario as unknown as import("@eval/scenario/schema.js").EvalScenario,
        ],
      ])
      const hooks = createEvalHooks({
        fixtureManager: manager,
        sessionExport: false,
        rawScenarios: rawScenariosMap,
      })

      // First run beforeScenario to seed the resource and store it in iterationResources
      await hooks.beforeScenario?.({
        scenario: rawScenario as unknown as import("@ghx-dev/agent-profiler").BaseScenario,
        mode: "ghx",
        model: "test-model",
        iteration: 0,
      })

      // afterScenario should NOT throw even though closeResource throws
      await expect(
        hooks.afterScenario?.({
          scenario: { id: "cleanup-err-001" } as never,
          mode: "ghx",
          model: "test-model",
          iteration: 0,
          result: {} as never,
          trace: null,
        } as import("@ghx-dev/agent-profiler").AfterScenarioContext),
      ).resolves.toBeUndefined()
    })
  })
})

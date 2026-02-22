import { runSuite } from "@bench/runner/suite.js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { makeWorkflowScenario } from "../../helpers/scenario-factory.js"

vi.mock("@bench/runner/scenario-runner.js", () => ({
  runScenarioIteration: vi.fn(),
}))

vi.mock("@bench/provider/factory.js", () => ({
  createSessionProvider: vi.fn(),
}))

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return {
    ...actual,
    mkdir: vi.fn().mockResolvedValue(undefined),
    appendFile: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock("@bench/fixture/manifest.js", () => ({
  resolveWorkflowFixtureBindings: vi.fn((s) => s),
}))

describe("runSuite", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockBenchmarkRow = {
    timestamp: "2026-01-01T00:00:00.000Z",
    run_id: "r1",
    mode: "ghx" as const,
    scenario_id: "s1",
    scenario_set: null,
    iteration: 1,
    session_id: "sess1",
    success: true,
    output_valid: true,
    latency_ms_wall: 100,
    sdk_latency_ms: 90,
    tokens: {
      input: 10,
      output: 10,
      reasoning: 0,
      cache_read: 0,
      cache_write: 0,
      total: 20,
    },
    cost: 0.01,
    tool_calls: 2,
    api_calls: 0,
    internal_retry_count: 0,
    external_retry_count: 0,
    model: { provider_id: "openai", model_id: "gpt-4", mode: null },
    git: { repo: null, commit: null },
    error: null,
  }

  it("emits events in correct order: suite_started, scenario_started, scenario_finished, suite_finished", async () => {
    const { runScenarioIteration } = await import("@bench/runner/scenario-runner.js")
    const { createSessionProvider } = await import("@bench/provider/factory.js")

    vi.mocked(runScenarioIteration).mockResolvedValue(mockBenchmarkRow)
    vi.mocked(createSessionProvider).mockResolvedValue({
      createSession: vi.fn(),
      prompt: vi.fn(),
      cleanup: vi.fn().mockResolvedValue(undefined),
    } as unknown as import("@bench/provider/types.js").SessionProvider)

    const events: Array<{ type: string }> = []
    const onProgress = (event: unknown) => events.push(event as { type: string })

    const scenario = makeWorkflowScenario()

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 1,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress,
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
    })

    const eventTypes = events.map((e) => e.type)
    expect(eventTypes).toContain("suite_started")
    expect(eventTypes).toContain("scenario_started")
    expect(eventTypes).toContain("scenario_finished")
    expect(eventTypes).toContain("suite_finished")

    const suiteStartedIdx = eventTypes.indexOf("suite_started")
    const scenarioStartedIdx = eventTypes.indexOf("scenario_started")
    const scenarioFinishedIdx = eventTypes.indexOf("scenario_finished")
    const suiteFinishedIdx = eventTypes.indexOf("suite_finished")

    expect(suiteStartedIdx < scenarioStartedIdx).toBe(true)
    expect(scenarioStartedIdx < scenarioFinishedIdx).toBe(true)
    expect(scenarioFinishedIdx < suiteFinishedIdx).toBe(true)
  })

  it("skips warmup run when skipWarmup=true", async () => {
    const { runScenarioIteration } = await import("@bench/runner/scenario-runner.js")
    const { createSessionProvider } = await import("@bench/provider/factory.js")

    vi.mocked(runScenarioIteration).mockResolvedValue(mockBenchmarkRow)
    vi.mocked(createSessionProvider).mockResolvedValue({
      createSession: vi.fn(),
      prompt: vi.fn(),
      cleanup: vi.fn().mockResolvedValue(undefined),
    } as unknown as import("@bench/provider/types.js").SessionProvider)

    const scenario = makeWorkflowScenario()

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 2,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
    })

    // 1 scenario * 2 repetitions = 2 iterations (no warmup)
    expect(vi.mocked(runScenarioIteration)).toHaveBeenCalledTimes(2)
  })

  it("runs warmup when skipWarmup=false", async () => {
    const { runScenarioIteration } = await import("@bench/runner/scenario-runner.js")
    const { createSessionProvider } = await import("@bench/provider/factory.js")

    vi.mocked(runScenarioIteration).mockResolvedValue(mockBenchmarkRow)
    const mockCleanup = vi.fn().mockResolvedValue(undefined)
    vi.mocked(createSessionProvider).mockResolvedValue({
      createSession: vi.fn(),
      prompt: vi.fn(),
      cleanup: mockCleanup,
    } as unknown as import("@bench/provider/types.js").SessionProvider)

    const scenario = makeWorkflowScenario()

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 1,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: false,
    })

    // 1 warmup + 1 scenario * 1 repetition = 2 iterations
    expect(vi.mocked(runScenarioIteration)).toHaveBeenCalledTimes(2)
    // One cleanup for warmup provider, one for main provider
    expect(mockCleanup).toHaveBeenCalledTimes(2)
  })

  it("appends JSONL to file for each scenario run", async () => {
    const { runScenarioIteration } = await import("@bench/runner/scenario-runner.js")
    const { createSessionProvider } = await import("@bench/provider/factory.js")
    const { appendFile } = await import("node:fs/promises")

    vi.mocked(runScenarioIteration).mockResolvedValue(mockBenchmarkRow)
    vi.mocked(createSessionProvider).mockResolvedValue({
      createSession: vi.fn(),
      prompt: vi.fn(),
      cleanup: vi.fn().mockResolvedValue(undefined),
    } as unknown as import("@bench/provider/types.js").SessionProvider)

    const scenario = makeWorkflowScenario()

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 2,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
    })

    // 2 scenarios * 2 repetitions = 4 appends (no warmup)
    expect(vi.mocked(appendFile)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(appendFile)).toHaveBeenCalledWith(
      "/tmp/test.jsonl",
      expect.stringContaining(JSON.stringify(mockBenchmarkRow)),
      "utf8",
    )
  })

  it("returns rowCount and durationMs", async () => {
    const { runScenarioIteration } = await import("@bench/runner/scenario-runner.js")
    const { createSessionProvider } = await import("@bench/provider/factory.js")

    vi.mocked(runScenarioIteration).mockResolvedValue(mockBenchmarkRow)
    vi.mocked(createSessionProvider).mockResolvedValue({
      createSession: vi.fn(),
      prompt: vi.fn(),
      cleanup: vi.fn().mockResolvedValue(undefined),
    } as unknown as import("@bench/provider/types.js").SessionProvider)

    const scenario = makeWorkflowScenario()

    const result = await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 3,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
    })

    expect(result.rowCount).toBe(3)
    expect(typeof result.durationMs).toBe("number")
    expect(result.durationMs >= 0).toBe(true)
  })

  it("emits suite_error event and rethrows when runScenarioIteration throws", async () => {
    const { runScenarioIteration } = await import("@bench/runner/scenario-runner.js")
    const { createSessionProvider } = await import("@bench/provider/factory.js")

    const thrownError = new Error("Scenario failed")
    vi.mocked(runScenarioIteration).mockRejectedValueOnce(thrownError)
    vi.mocked(createSessionProvider).mockResolvedValue({
      createSession: vi.fn(),
      prompt: vi.fn(),
      cleanup: vi.fn().mockResolvedValue(undefined),
    } as unknown as import("@bench/provider/types.js").SessionProvider)

    const events: Array<{ type: string; message?: string }> = []
    const onProgress = (event: unknown) => events.push(event as { type: string })

    const scenario = makeWorkflowScenario()

    await expect(
      runSuite({
        modes: ["ghx"],
        scenarios: [scenario],
        repetitions: 1,
        manifest: null,
        outputJsonlPath: "/tmp/test.jsonl",
        onProgress,
        providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
        skipWarmup: true,
      }),
    ).rejects.toThrow("Scenario failed")

    const errorEvent = events.find((e) => e.type === "suite_error")
    expect(errorEvent).toBeDefined()
    expect(errorEvent?.message).toBe("Scenario failed")
  })

  it("rowCount equals scenarios * repetitions * modes", async () => {
    const { runScenarioIteration } = await import("@bench/runner/scenario-runner.js")
    const { createSessionProvider } = await import("@bench/provider/factory.js")

    vi.mocked(runScenarioIteration).mockResolvedValue(mockBenchmarkRow)
    vi.mocked(createSessionProvider).mockResolvedValue({
      createSession: vi.fn(),
      prompt: vi.fn(),
      cleanup: vi.fn().mockResolvedValue(undefined),
    } as unknown as import("@bench/provider/types.js").SessionProvider)

    const scenario1 = makeWorkflowScenario({ id: "s1" })
    const scenario2 = makeWorkflowScenario({ id: "s2" })

    const result = await runSuite({
      modes: ["ghx", "agent_direct"],
      scenarios: [scenario1, scenario2],
      repetitions: 3,
      manifest: null,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
    })

    // 2 scenarios * 3 repetitions * 2 modes = 12
    expect(result.rowCount).toBe(12)
  })

  it("passes manifest to runScenarioIteration when manifest is non-null", async () => {
    const { runScenarioIteration } = await import("@bench/runner/scenario-runner.js")
    const { createSessionProvider } = await import("@bench/provider/factory.js")

    vi.mocked(runScenarioIteration).mockResolvedValue(mockBenchmarkRow)
    vi.mocked(createSessionProvider).mockResolvedValue({
      createSession: vi.fn(),
      prompt: vi.fn(),
      cleanup: vi.fn().mockResolvedValue(undefined),
    } as unknown as import("@bench/provider/types.js").SessionProvider)

    const scenario = makeWorkflowScenario()
    const manifest = {
      version: 1 as const,
      repo: {
        owner: "test",
        name: "repo",
        full_name: "test/repo",
        default_branch: "main",
      },
      resources: {},
    }

    await runSuite({
      modes: ["ghx"],
      scenarios: [scenario],
      repetitions: 1,
      manifest,
      outputJsonlPath: "/tmp/test.jsonl",
      onProgress: () => {},
      providerConfig: { type: "opencode", providerId: "test", modelId: "test" },
      skipWarmup: true,
    })

    expect(vi.mocked(runScenarioIteration)).toHaveBeenCalledWith(
      expect.objectContaining({ manifest }),
    )
  })
})

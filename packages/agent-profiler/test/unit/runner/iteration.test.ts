import { describe, expect, it, vi } from "vitest"
import type { Analyzer } from "../../../src/contracts/analyzer.js"
import type { Collector } from "../../../src/contracts/collector.js"
import type { RunHooks } from "../../../src/contracts/hooks.js"
import type { IterationParams } from "../../../src/runner/iteration.js"
import { runIteration } from "../../../src/runner/iteration.js"
import { makePromptResult, makeScenario } from "../../helpers/factories.js"
import { createMockProvider } from "../../helpers/mock-provider.js"
import { createMockScorer } from "../../helpers/mock-scorer.js"

function makeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

function makeParams(overrides?: Partial<IterationParams>): IterationParams {
  return {
    provider: createMockProvider(),
    scorer: createMockScorer(),
    collectors: [],
    analyzers: [],
    hooks: {},
    scenario: makeScenario(),
    mode: "agent_direct",
    model: "test-model",
    iteration: 0,
    runId: "run_test",
    systemInstructions: "You are a test agent",
    sessionExport: true,
    allowedRetries: 0,
    logger: makeLogger(),
    ...overrides,
  }
}

describe("runIteration", () => {
  it("handles a prompt result with no tool calls", async () => {
    const provider = createMockProvider({
      promptResult: makePromptResult({
        metrics: {
          ...makePromptResult().metrics,
          toolCalls: [],
        },
      }),
    })

    const { row } = await runIteration(makeParams({ provider }))

    expect(row.toolCalls).toMatchObject({ total: 0, failed: 0, errorRate: 0 })
  })

  it("preserves actual and expected checkpoint details when supplied", async () => {
    const scorer = createMockScorer({
      details: [
        {
          id: "output",
          description: "Expected output",
          passed: false,
          actual: "actual",
          expected: "expected",
        },
      ],
    })

    const { row } = await runIteration(makeParams({ scorer }))

    expect(row.checkpointDetails).toEqual([
      expect.objectContaining({ actual: "actual", expected: "expected" }),
    ])
  })

  it("uses the default timeout when the scenario omits one", async () => {
    const provider = createMockProvider()
    const scenario = {
      ...makeScenario(),
      timeoutMs: undefined,
    } as unknown as IterationParams["scenario"]

    await runIteration(makeParams({ provider, scenario }))

    expect(provider.calls.prompt?.[0]?.[2]).toBe(120_000)
  })

  it("keeps the original scenario when beforeScenario returns nothing", async () => {
    const provider = createMockProvider()
    const beforeScenario = vi.fn().mockResolvedValue(undefined)

    await runIteration(makeParams({ provider, hooks: { beforeScenario } }))

    expect(provider.calls.prompt?.[0]?.[1]).toBe("Fix the bug in main.ts")
  })

  it("produces valid ProfileRow with correct fields", async () => {
    const provider = createMockProvider()
    const params = makeParams({ provider })

    const { row, trace, analysisResults } = await runIteration(params)
    expect(analysisResults).toHaveLength(0)

    expect(row.runId).toBe("run_test")
    expect(row.scenarioId).toBe("test-scenario-001")
    expect(row.mode).toBe("agent_direct")
    expect(row.model).toBe("test-model")
    expect(row.iteration).toBe(0)
    expect(row.success).toBe(true)
    expect(row.checkpointsPassed).toBe(3)
    expect(row.checkpointsTotal).toBe(3)
    expect(row.tokens.total).toBe(150)
    expect(row.toolCalls.total).toBe(3)
    expect(row.toolCalls.failed).toBe(1)
    expect(row.toolCalls.byCategory).toEqual({ shell: 2, file: 1 })
    expect(row.toolCalls.errorRate).toBeCloseTo(1 / 3)
    expect(row.completionReason).toBe("stop")
    expect(row.provider).toBe("mock-provider")
    expect(row.sessionId).toBe("ses_test_001")
    expect(row.agentTurns).toBe(3) // from trace summary
    expect(trace).not.toBeNull()
  })

  it("calls beforeScenario and afterScenario hooks", async () => {
    const beforeScenario = vi.fn()
    const afterScenario = vi.fn()
    const hooks: RunHooks = { beforeScenario, afterScenario }
    const params = makeParams({ hooks })

    await runIteration(params)

    expect(beforeScenario).toHaveBeenCalledTimes(1)
    expect(beforeScenario).toHaveBeenCalledWith(
      expect.objectContaining({
        scenario: params.scenario,
        mode: "agent_direct",
        model: "test-model",
        iteration: 0,
      }),
    )
    expect(afterScenario).toHaveBeenCalledTimes(1)
    expect(afterScenario).toHaveBeenCalledWith(
      expect.objectContaining({
        scenario: params.scenario,
        mode: "agent_direct",
        model: "test-model",
        iteration: 0,
        result: expect.objectContaining({ success: true }),
        trace: expect.anything(),
      }),
    )
  })

  it("uses scenario returned by beforeScenario for prompt and afterScenario", async () => {
    const replacementScenario = makeScenario({
      id: "test-scenario-001",
      prompt: "Rebound prompt with PR #999",
    })
    const beforeScenario = vi.fn().mockResolvedValue(replacementScenario)
    const afterScenario = vi.fn()
    const provider = createMockProvider()
    const hooks: RunHooks = { beforeScenario, afterScenario }
    const params = makeParams({ hooks, provider })

    await runIteration(params)

    // provider.prompt should have been called with the rebound prompt
    // calls.prompt entries are [handle, text, timeoutMs]
    expect(provider.calls.prompt?.length).toBe(1)
    expect(provider.calls.prompt?.[0]?.[1]).toBe("Rebound prompt with PR #999")

    // afterScenario receives the replacement scenario
    expect(afterScenario).toHaveBeenCalledWith(
      expect.objectContaining({ scenario: replacementScenario }),
    )
  })

  it("calls destroySession in finally (even on error)", async () => {
    const provider = createMockProvider()
    provider.prompt = async () => {
      throw new Error("prompt failure")
    }
    const params = makeParams({ provider })

    const { row } = await runIteration(params)

    expect(row.success).toBe(false)
    expect(row.error).toBe("prompt failure")
    expect(provider.calls.destroySession?.length ?? 0).toBe(1)
  })

  it("returns failed row with success=false on prompt error", async () => {
    const provider = createMockProvider()
    provider.prompt = async () => {
      throw new Error("timeout exceeded")
    }
    const params = makeParams({ provider })

    const { row, trace } = await runIteration(params)

    expect(row.success).toBe(false)
    expect(row.error).toBe("timeout exceeded")
    expect(row.completionReason).toBe("error")
    expect(row.tokens.total).toBe(0)
    expect(row.toolCalls.total).toBe(0)
    expect(trace).toBeNull()
  })

  it("normalizes a non-Error prompt rejection", async () => {
    const provider = createMockProvider()
    provider.prompt = () => Promise.reject("provider rejected")

    const { row } = await runIteration(makeParams({ provider }))

    expect(row.error).toBe("provider rejected")
  })

  it("calls afterScenario with the failed row", async () => {
    const provider = createMockProvider()
    provider.createSession = () => Promise.reject(new Error("session unavailable"))
    const afterScenario = vi.fn()

    const { row } = await runIteration(makeParams({ provider, hooks: { afterScenario } }))

    expect(afterScenario).toHaveBeenCalledWith(
      expect.objectContaining({ result: row, trace: null }),
    )
  })

  it("collects metrics from all collectors into extensions", async () => {
    const collector1: Collector = {
      id: "c1",
      async collect() {
        return [{ name: "lines_changed", value: 42, unit: "lines" }]
      },
    }
    const collector2: Collector = {
      id: "c2",
      async collect() {
        return [
          { name: "files_read", value: 5, unit: "count" },
          { name: "complexity", value: "medium", unit: "" },
        ]
      },
    }
    const params = makeParams({ collectors: [collector1, collector2] })

    const { row } = await runIteration(params)

    expect(row.extensions).toEqual({
      lines_changed: 42,
      files_read: 5,
      complexity: "medium",
    })
  })

  it("sets agentTurns to 1 when sessionExport is disabled", async () => {
    const params = makeParams({ sessionExport: false })

    const { row, trace } = await runIteration(params)

    expect(row.agentTurns).toBe(1)
    expect(trace).toBeNull()
  })

  it("runs analyzers and returns analysis results when trace is available", async () => {
    const mockAnalyzer: Analyzer = {
      name: "test-analyzer",
      async analyze(_trace, _scenario, _mode) {
        return {
          analyzer: "test-analyzer",
          findings: { score: { type: "number", value: 42, unit: "pts" } },
          summary: "all good",
        }
      },
    }
    const params = makeParams({ analyzers: [mockAnalyzer], sessionExport: true })

    const { analysisResults } = await runIteration(params)

    expect(analysisResults).toHaveLength(1)
    expect(analysisResults[0]?.analyzer).toBe("test-analyzer")
    expect(analysisResults[0]?.summary).toBe("all good")
  })

  it("exports session for analyzers even when sessionExport is false", async () => {
    const mockAnalyzer: Analyzer = {
      name: "needs-trace-analyzer",
      async analyze(_trace, _scenario, _mode) {
        return { analyzer: "needs-trace-analyzer", findings: {}, summary: "ok" }
      },
    }
    const provider = createMockProvider()
    const params = makeParams({ analyzers: [mockAnalyzer], sessionExport: false, provider })

    const { analysisResults } = await runIteration(params)

    expect(analysisResults).toHaveLength(1)
    // exportSession should have been called despite sessionExport: false
    expect(provider.calls.exportSession?.length ?? 0).toBe(1)
  })

  it("enforces timeout when provider.prompt hangs", async () => {
    const provider = createMockProvider()
    provider.prompt = () => new Promise<never>(() => {}) // never resolves
    const scenario = makeScenario({ timeoutMs: 50 })
    const params = makeParams({ provider, scenario, allowedRetries: 0 })

    const { row } = await runIteration(params)

    expect(row.success).toBe(false)
    expect(row.error).toContain("timed out")
    expect(provider.calls.destroySession?.length ?? 0).toBeGreaterThanOrEqual(1)
  })

  it("returns empty analysisResults on error", async () => {
    const provider = createMockProvider()
    provider.prompt = async () => {
      throw new Error("prompt failed")
    }
    const mockAnalyzer: Analyzer = {
      name: "test-analyzer",
      async analyze(_trace, _scenario, _mode) {
        return { analyzer: "test-analyzer", findings: {}, summary: "ok" }
      },
    }
    const params = makeParams({ provider, analyzers: [mockAnalyzer] })

    const { analysisResults } = await runIteration(params)

    expect(analysisResults).toHaveLength(0)
  })

  it("succeeds on retry when first attempt throws", async () => {
    const provider = createMockProvider()
    let attempt = 0
    const originalPrompt = provider.prompt.bind(provider)
    provider.prompt = async (handle, text, timeoutMs) => {
      attempt++
      if (attempt === 1) throw new Error("first attempt failed")
      return originalPrompt(handle, text, timeoutMs)
    }
    const logger = makeLogger()
    const params = makeParams({ provider, allowedRetries: 1, logger })

    const { row } = await runIteration(params)

    expect(row.success).toBe(true)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("retrying"))
  })

  it("returns failed row when all retries exhausted", async () => {
    const provider = createMockProvider()
    provider.prompt = async () => {
      throw new Error("always fails")
    }
    const params = makeParams({ provider, allowedRetries: 2 })

    const { row } = await runIteration(params)

    expect(row.success).toBe(false)
    expect(row.error).toBe("always fails")
  })

  it("destroys session after each failed attempt before retrying", async () => {
    const provider = createMockProvider()
    let promptCallCount = 0
    const originalPrompt = provider.prompt.bind(provider)
    provider.prompt = async (handle, text, timeoutMs) => {
      promptCallCount++
      if (promptCallCount < 3) throw new Error("temporary failure")
      return originalPrompt(handle, text, timeoutMs)
    }
    const params = makeParams({ provider, allowedRetries: 2 })

    const { row } = await runIteration(params)

    expect(row.success).toBe(true)
    // 2 failed attempts destroyed + 1 success destroyed in finally = 3 destroySession calls
    expect(provider.calls.destroySession?.length ?? 0).toBe(3)
  })

  it("logs warning when destroySession throws during retry cleanup", async () => {
    const provider = createMockProvider()
    let promptAttempts = 0
    const originalPrompt = provider.prompt.bind(provider)
    provider.prompt = async (handle, text, timeoutMs) => {
      promptAttempts++
      if (promptAttempts === 1) throw new Error("first attempt failed")
      return originalPrompt(handle, text, timeoutMs)
    }
    // destroySession throws on first call (during retry cleanup)
    let destroyCallCount = 0
    const originalDestroy = provider.destroySession.bind(provider)
    provider.destroySession = async (handle) => {
      destroyCallCount++
      if (destroyCallCount === 1) throw new Error("session already gone")
      return originalDestroy(handle)
    }
    const logger = makeLogger()
    const params = makeParams({ provider, allowedRetries: 1, logger })

    const { row } = await runIteration(params)

    // Iteration succeeds on the retry despite the destroySession failure
    expect(row.success).toBe(true)
    // logger.warn called with the destroy error
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Failed to destroy session during retry cleanup"),
    )
  })

  it("normalizes a non-Error destroy rejection during retry cleanup", async () => {
    const provider = createMockProvider()
    let promptAttempts = 0
    const originalPrompt = provider.prompt.bind(provider)
    provider.prompt = (handle, text, timeoutMs) => {
      promptAttempts++
      return promptAttempts === 1
        ? Promise.reject(new Error("retry"))
        : originalPrompt(handle, text, timeoutMs)
    }
    let destroyAttempts = 0
    const originalDestroy = provider.destroySession.bind(provider)
    provider.destroySession = (handle) => {
      destroyAttempts++
      return destroyAttempts === 1 ? Promise.reject("already gone") : originalDestroy(handle)
    }
    const logger = makeLogger()

    const { row } = await runIteration(makeParams({ provider, allowedRetries: 1, logger }))

    expect(row.success).toBe(true)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("already gone"))
  })

  it("logs a non-Error final destroy rejection", async () => {
    const provider = createMockProvider()
    provider.destroySession = () => Promise.reject("cleanup failed")
    const logger = makeLogger()

    const { row } = await runIteration(makeParams({ provider, logger }))

    expect(row.success).toBe(true)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("cleanup failed"))
  })

  it("logs an Error from final session cleanup", async () => {
    const provider = createMockProvider()
    provider.destroySession = () => Promise.reject(new Error("cleanup failed"))
    const logger = makeLogger()

    const { row } = await runIteration(makeParams({ provider, logger }))

    expect(row.success).toBe(true)
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("cleanup failed"))
  })
})

import { describe, expect, it, vi } from "vitest"
import type { ProfileSuiteOptions } from "../../../src/runner/profile-runner.js"
import { runProfileSuite } from "../../../src/runner/profile-runner.js"
import { makeScenario } from "../../helpers/factories.js"
import { createMockModeResolver } from "../../helpers/mock-mode-resolver.js"
import { createMockProvider } from "../../helpers/mock-provider.js"
import { createMockScorer } from "../../helpers/mock-scorer.js"

vi.mock("@profiler/store/jsonl-store.js", () => ({
  appendJsonlLine: vi.fn().mockResolvedValue(undefined),
}))

function makeOptions(overrides?: Partial<ProfileSuiteOptions>): ProfileSuiteOptions {
  return {
    modes: ["mode_a"],
    scenarios: [makeScenario()],
    repetitions: 1,
    allowedRetries: 0,
    provider: createMockProvider(),
    scorer: createMockScorer(),
    modeResolver: createMockModeResolver(),
    collectors: [],
    analyzers: [],
    hooks: {},
    warmup: false,
    sessionExport: false,
    outputJsonlPath: "/tmp/test-output.jsonl",
    logLevel: "error",
    ...overrides,
  }
}

describe("runProfileSuite", () => {
  it("produces correct matrix expansion: 2 modes x 2 scenarios x 2 reps = 8 rows", async () => {
    const options = makeOptions({
      modes: ["mode_a", "mode_b"],
      scenarios: [makeScenario({ id: "s1" }), makeScenario({ id: "s2" })],
      repetitions: 2,
    })

    const result = await runProfileSuite(options)

    expect(result.rows).toHaveLength(8)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.runId).toMatch(/^run_\d+$/)
    expect(result.outputJsonlPath).toBe("/tmp/test-output.jsonl")
  })

  it("fires hooks in correct order", async () => {
    const order: string[] = []
    const hooks = {
      beforeRun: vi.fn(async () => {
        order.push("beforeRun")
      }),
      afterRun: vi.fn(async () => {
        order.push("afterRun")
      }),
      beforeMode: vi.fn(async (mode: string) => {
        order.push(`beforeMode:${mode}`)
      }),
      afterMode: vi.fn(async (mode: string) => {
        order.push(`afterMode:${mode}`)
      }),
      beforeScenario: vi.fn(async () => {
        order.push("beforeScenario")
        return undefined
      }),
      afterScenario: vi.fn(async () => {
        order.push("afterScenario")
      }),
    }
    const options = makeOptions({
      modes: ["mode_a", "mode_b"],
      scenarios: [makeScenario()],
      repetitions: 1,
      hooks,
    })

    await runProfileSuite(options)

    expect(order).toEqual([
      "beforeRun",
      "beforeMode:mode_a",
      "beforeScenario",
      "afterScenario",
      "afterMode:mode_a",
      "beforeMode:mode_b",
      "beforeScenario",
      "afterScenario",
      "afterMode:mode_b",
      "afterRun",
    ])
  })

  it("skips warmup when warmup flag is false", async () => {
    const provider = createMockProvider()
    const options = makeOptions({
      provider,
      warmup: false,
      scenarios: [makeScenario()],
      repetitions: 1,
    })

    await runProfileSuite(options)

    // With warmup=false, createSession should be called once (for the single iteration only)
    expect(provider.calls.createSession?.length ?? 0).toBe(1)
  })

  it("runs warmup when warmup flag is true", async () => {
    const provider = createMockProvider()
    const options = makeOptions({
      provider,
      warmup: true,
      scenarios: [makeScenario()],
      repetitions: 1,
    })

    await runProfileSuite(options)

    // warmup (1) + iteration (1) = 2 createSession calls
    expect(provider.calls.createSession?.length ?? 0).toBe(2)
  })

  it("runs warmup once per mode when warmup flag is true", async () => {
    const provider = createMockProvider()
    const options = makeOptions({
      provider,
      warmup: true,
      modes: ["mode_a", "mode_b"],
      scenarios: [makeScenario()],
      repetitions: 1,
    })

    await runProfileSuite(options)

    // 2 modes × (warmup(1) + iteration(1)) = 4 createSession calls
    expect(provider.calls.createSession?.length ?? 0).toBe(4)
  })

  it("calls appendJsonlLine for each row", async () => {
    const { appendJsonlLine } = await import("@profiler/store/jsonl-store.js")
    vi.mocked(appendJsonlLine).mockClear()

    const options = makeOptions({
      modes: ["mode_a"],
      scenarios: [makeScenario()],
      repetitions: 3,
    })

    await runProfileSuite(options)

    expect(appendJsonlLine).toHaveBeenCalledTimes(3)
  })

  it("calls shutdown always", async () => {
    const provider = createMockProvider()
    const options = makeOptions({ provider })

    await runProfileSuite(options)

    expect(provider.calls.shutdown?.length ?? 0).toBe(1)
  })

  it("calls provider.shutdown even when the main loop throws", async () => {
    const { appendJsonlLine } = await import("@profiler/store/jsonl-store.js")
    vi.mocked(appendJsonlLine).mockRejectedValueOnce(new Error("disk write failed"))

    const provider = createMockProvider()
    const options = makeOptions({ provider })

    await expect(runProfileSuite(options)).rejects.toThrow("disk write failed")
    expect(provider.calls.shutdown?.length ?? 0).toBe(1)
  })

  it("calls init and shutdown once per mode", async () => {
    const provider = createMockProvider()
    const options = makeOptions({
      provider,
      modes: ["mode_a", "mode_b", "mode_c"],
      scenarios: [makeScenario()],
      repetitions: 1,
    })

    await runProfileSuite(options)

    expect(provider.calls.init?.length ?? 0).toBe(3)
    expect(provider.calls.shutdown?.length ?? 0).toBe(3)
  })

  it("passes modeConfig.environment to provider.init", async () => {
    const provider = createMockProvider()
    const resolver = createMockModeResolver({
      ghx: { environment: { PATH: "/custom/bin:/usr/bin" } },
      baseline: { environment: {} },
    })
    const options = makeOptions({
      provider,
      modes: ["ghx", "baseline"],
      scenarios: [makeScenario()],
      repetitions: 1,
      modeResolver: resolver,
    })

    await runProfileSuite(options)

    const initCalls = provider.calls.init as [
      import("../../../src/contracts/provider.js").ProviderConfig,
    ][]
    expect(initCalls[0]?.[0]?.environment).toEqual({ PATH: "/custom/bin:/usr/bin" })
    expect(initCalls[1]?.[0]?.environment).toEqual({})
  })
})

import type { Scenario } from "@bench/domain/types.js"
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest"

const loadScenariosMock = vi.hoisted(() => vi.fn())
const loadScenarioSetsMock = vi.hoisted(() => vi.fn())

vi.mock("@bench/scenario/loader.js", () => ({
  loadScenarios: loadScenariosMock,
  loadScenarioSets: loadScenarioSetsMock,
}))

function mockScenario(id: string): Scenario {
  return {
    type: "workflow",
    id,
    name: `Scenario ${id}`,
    prompt: "Do some work",
    expected_capabilities: [],
    timeout_ms: 60000,
    allowed_retries: 0,
    assertions: {
      expected_outcome: "success",
      checkpoints: [],
    },
    tags: [],
  }
}

describe("check-command", () => {
  let consoleLogSpy: MockInstance
  let consoleErrorSpy: MockInstance
  let processExitSpy: MockInstance

  beforeEach(() => {
    vi.clearAllMocks()
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never)

    loadScenarioSetsMock.mockResolvedValue({
      default: ["s1"],
      workflows: ["s1"],
      all: ["s1"],
      "full-seeded": ["s1"],
    })
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
  })

  it("validates scenarios and scenario sets successfully", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await import("@bench/cli/check-command.js")

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Validated"))
  })

  it("throws error for duplicate scenario IDs", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1"), mockScenario("s1")])

    vi.resetModules()
    await import("@bench/cli/check-command.js")

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Duplicate scenario"))
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })

  it("throws error for missing required scenario set", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])
    loadScenarioSetsMock.mockResolvedValue({ default: ["s1"] })

    vi.resetModules()
    await import("@bench/cli/check-command.js")

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing required scenario set"),
    )
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })

  it("throws error when scenario set references unknown scenario id", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["unknown"],
      workflows: ["s1"],
      all: ["s1"],
      "full-seeded": ["s1"],
    })

    vi.resetModules()
    await import("@bench/cli/check-command.js")

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("references unknown scenario id"),
    )
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })

  it("throws error for orphan scenario not in any set", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1"), mockScenario("orphan")])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["s1"],
      workflows: ["s1"],
      all: ["s1"],
      "full-seeded": ["s1"],
    })

    vi.resetModules()
    await import("@bench/cli/check-command.js")

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("orphan scenario"))
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })

  it("throws error when no scenarios found", async () => {
    loadScenariosMock.mockResolvedValue([])

    vi.resetModules()
    await import("@bench/cli/check-command.js")

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("No benchmark scenarios found"),
    )
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })

  it("logs validation summary with scenario and set counts", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1"), mockScenario("s2")])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["s1"],
      workflows: ["s2"],
      all: ["s1", "s2"],
      "full-seeded": ["s1", "s2"],
    })

    vi.resetModules()
    await import("@bench/cli/check-command.js")

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Validated 2 benchmark scenarios/),
    )
  })

  it("handles complex scenario references across multiple sets", async () => {
    loadScenariosMock.mockResolvedValue([
      mockScenario("s1"),
      mockScenario("s2"),
      mockScenario("s3"),
    ])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["s1"],
      workflows: ["s1", "s2"],
      all: ["s1", "s2", "s3"],
      "full-seeded": ["s1", "s2", "s3"],
    })

    vi.resetModules()
    await import("@bench/cli/check-command.js")

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Validated"))
  })
})

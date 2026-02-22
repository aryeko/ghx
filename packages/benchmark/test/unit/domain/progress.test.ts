import { emitProgress } from "@bench/domain/progress.js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("emitProgress", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("logs JSON-stringified event to console", () => {
    const event = {
      timestamp: "2024-01-01T00:00:00.000Z",
      type: "suite_start" as const,
    }
    emitProgress(event)
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(event))
  })

  it("includes all event fields in output", () => {
    const event = {
      timestamp: "2024-01-01T00:00:00.000Z",
      type: "scenario_end" as const,
      mode: "ghx" as const,
      scenarioId: "test-scenario",
      iteration: 1,
      durationMs: 1234,
      status: "success" as const,
      message: "done",
    }
    emitProgress(event)
    expect(console.log).toHaveBeenCalledWith(JSON.stringify(event))
  })
})

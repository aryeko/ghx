import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

import { mkdir, writeFile } from "node:fs/promises"
import { generateReport } from "@profiler/reporter/orchestrator.js"
import { makeProfileRow } from "./_make-profile-row.js"

describe("generateReport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates data directory", async () => {
    const rows = [makeProfileRow()]
    await generateReport({
      runId: "run_1",
      rows,
      reportsDir: "/tmp/reports",
    })
    expect(mkdir).toHaveBeenCalledTimes(1)
    const mkdirMock = vi.mocked(mkdir)
    const firstCall = mkdirMock.mock.calls[0]
    expect(firstCall?.[0]).toMatch(/data$/)
  })

  it("writes all expected files", async () => {
    const rows = [makeProfileRow({ scenarioId: "s1" }), makeProfileRow({ scenarioId: "s2" })]
    await generateReport({
      runId: "run_1",
      rows,
      reportsDir: "/tmp/reports",
    })

    const writeFileMock = vi.mocked(writeFile)
    const writtenPaths = writeFileMock.mock.calls.map((c) => String(c[0]))

    // 2 pages (report.md + analysis.md) + 3 data files = 5
    expect(writtenPaths.length).toBe(5)

    expect(writtenPaths.some((p) => p.endsWith("report.md"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("analysis.md"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("results.csv"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("results.json"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("summary.json"))).toBe(true)
  })

  it("returns the report directory path", async () => {
    const result = await generateReport({
      runId: "run_1",
      rows: [makeProfileRow()],
      reportsDir: "/tmp/reports",
    })
    expect(result).toMatch(/^\/tmp\/reports\//)
  })

  it("handles empty rows", async () => {
    await generateReport({
      runId: "run_empty",
      rows: [],
      reportsDir: "/tmp/reports",
    })

    const writeFileMock = vi.mocked(writeFile)
    // 2 pages (report.md + analysis.md) + 3 data files = 5
    expect(writeFileMock.mock.calls.length).toBe(5)
  })

  it("logs warning and continues when writeFile rejects for a single page", async () => {
    const writeFileMock = vi.mocked(writeFile)
    writeFileMock.mockRejectedValueOnce(new Error("ENOSPC: no space left on device"))

    const logger = { warn: vi.fn() }
    const rows = [makeProfileRow()]
    const result = await generateReport({
      runId: "run_1",
      rows,
      reportsDir: "/tmp/reports",
      logger,
    })

    expect(result).toBeDefined()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("ENOSPC: no space left on device"),
    )

    // Other pages should still be written
    const writtenPaths = writeFileMock.mock.calls.map((c) => String(c[0]))
    expect(writtenPaths.some((p) => p.endsWith("results.csv"))).toBe(true)
  })

  it("passes analysis results to analysis page", async () => {
    const rows = [makeProfileRow()]
    const result = await generateReport({
      runId: "run_1",
      rows,
      reportsDir: "/tmp/reports",
      analysisResults: [
        {
          sessionId: "ses_001",
          scenarioId: "s1",
          mode: "mode_a",
          model: "test-model",
          results: {},
        },
      ],
    })
    expect(result).toBeDefined()

    const writeFileMock = vi.mocked(writeFile)
    const analysisCall = writeFileMock.mock.calls.find((c) => String(c[0]).endsWith("analysis.md"))
    expect(analysisCall).toBeDefined()
    // Should not contain "No session analysis data available" since we passed bundles
    const content = String(analysisCall?.[1] ?? "")
    expect(content).toContain("# Session Analysis")
    expect(content).not.toContain("No session analysis data available")
  })
})

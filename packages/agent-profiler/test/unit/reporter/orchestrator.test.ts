import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}))

import { mkdir, writeFile } from "node:fs/promises"
import { generateReport } from "@profiler/reporter/orchestrator.js"
import type { ProfileRow } from "@profiler/types/profile-row.js"

function makeProfileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    runId: "run_test",
    scenarioId: "s1",
    mode: "mode_a",
    model: "test-model",
    iteration: 0,
    startedAt: "2026-02-27T00:00:00.000Z",
    completedAt: "2026-02-27T00:01:00.000Z",
    tokens: {
      input: 100,
      output: 50,
      reasoning: 20,
      cacheRead: 10,
      cacheWrite: 5,
      total: 150,
      active: 140,
    },
    timing: { wallMs: 1500, segments: [] },
    toolCalls: {
      total: 3,
      byCategory: { shell: 2, file: 1 },
      failed: 0,
      retried: 0,
      errorRate: 0,
      records: [],
    },
    cost: {
      totalUsd: 0.05,
      inputUsd: 0.02,
      outputUsd: 0.02,
      reasoningUsd: 0.01,
    },
    success: true,
    checkpointsPassed: 3,
    checkpointsTotal: 3,
    checkpointDetails: [],
    outputValid: true,
    provider: "test",
    sessionId: "ses_001",
    agentTurns: 3,
    completionReason: "stop",
    extensions: {},
    ...overrides,
  } as ProfileRow
}

describe("generateReport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates report directories", async () => {
    const rows = [makeProfileRow()]
    await generateReport({
      runId: "run_1",
      rows,
      reportsDir: "/tmp/reports",
    })
    expect(mkdir).toHaveBeenCalledTimes(2)
    const mkdirMock = vi.mocked(mkdir)
    const firstCall = mkdirMock.mock.calls[0]
    const secondCall = mkdirMock.mock.calls[1]
    expect(firstCall?.[0]).toMatch(/scenarios$/)
    expect(secondCall?.[0]).toMatch(/data$/)
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

    // 4 pages + 2 scenario pages + 3 data files = 9
    expect(writtenPaths.length).toBe(9)

    expect(writtenPaths.some((p) => p.endsWith("index.md"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("metrics.md"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("analysis.md"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("comparison.md"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("s1.md"))).toBe(true)
    expect(writtenPaths.some((p) => p.endsWith("s2.md"))).toBe(true)
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
    // 4 pages + 0 scenario pages + 3 data files = 7
    expect(writeFileMock.mock.calls.length).toBe(7)
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
  })
})

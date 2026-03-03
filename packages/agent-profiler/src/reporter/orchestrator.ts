import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { ProfileRow } from "@profiler/types/profile-row.js"
import type { SessionAnalysisBundle } from "@profiler/types/trace.js"
import { generateAnalysisPage } from "./analysis-page.js"
import { exportCsv } from "./csv-exporter.js"
import { exportResultsJson, exportSummaryJson } from "./json-exporter.js"
import type { ScenarioMetadata } from "./report-page.js"
import { generateReportPage } from "./report-page.js"

/** Options for generating a full profiler report from completed run data. */
export interface ReportOptions {
  /** Unique identifier of the profiling run being reported. */
  readonly runId: string
  /** All profile rows collected during the run. */
  readonly rows: readonly ProfileRow[]
  /** Absolute path to the directory where report files will be written. */
  readonly reportsDir: string
  /**
   * When provided, report files are written directly to this directory instead of
   * creating a timestamped subdirectory under `reportsDir`. Both `reportsDir` and
   * `reportDir` may be specified; `reportDir` takes precedence for file placement
   * while `reportsDir` is ignored.
   */
  readonly reportDir?: string
  /** Optional analysis bundles to include in the analysis page. */
  readonly analysisResults?: readonly SessionAnalysisBundle[]
  /** Optional scenario metadata for enriching per-scenario sections in report.md. */
  readonly scenarioMetadata?: readonly ScenarioMetadata[]
  /** Optional logger for non-fatal page generation warnings. */
  readonly logger?: { warn: (msg: string) => void }
}

// TODO: Consider returning { reportDir, failedPages } to signal partial failures to callers
async function safeWrite(
  path: string,
  generate: () => string,
  logger?: { warn: (msg: string) => void },
): Promise<void> {
  try {
    await writeFile(path, generate(), "utf-8")
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger?.warn(`Failed to generate report page ${path}: ${message}`)
  }
}

/**
 * Generate a report and data exports for a profiling run.
 *
 * Creates a timestamped subdirectory under `options.reportsDir` containing:
 * - `report.md` — unified self-contained report
 * - `analysis.md` — analyzer findings
 * - `data/results.csv` — raw CSV export
 * - `data/results.json` — raw JSON export
 * - `data/summary.json` — aggregated summary JSON
 *
 * @param options - Report configuration including run ID, rows, and output paths.
 * @returns The absolute path to the generated report directory.
 * @throws If the report directory cannot be created (mkdir failure).
 */
export async function generateReport(options: ReportOptions): Promise<string> {
  const { runId, rows, reportsDir, analysisResults, scenarioMetadata, logger } = options
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const reportDir = options.reportDir ?? join(reportsDir, timestamp)
  const dataDir = join(reportDir, "data")

  await mkdir(dataDir, { recursive: true })

  await Promise.all([
    safeWrite(
      join(reportDir, "report.md"),
      () =>
        generateReportPage({
          runId,
          rows,
          analysisResults: analysisResults ?? [],
          ...(scenarioMetadata ? { scenarioMetadata } : {}),
        }),
      logger,
    ),
    safeWrite(
      join(reportDir, "analysis.md"),
      () => generateAnalysisPage(analysisResults ?? [], scenarioMetadata),
      logger,
    ),
    safeWrite(join(dataDir, "results.csv"), () => exportCsv(rows), logger),
    safeWrite(join(dataDir, "results.json"), () => exportResultsJson(rows), logger),
    safeWrite(join(dataDir, "summary.json"), () => exportSummaryJson(rows, runId), logger),
  ])

  return reportDir
}

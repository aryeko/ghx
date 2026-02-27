import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { ProfileRow } from "@profiler/types/profile-row.js"
import type { SessionAnalysisBundle } from "@profiler/types/trace.js"
import { generateAnalysisPage } from "./analysis-page.js"
import { generateComparisonPage } from "./comparison-page.js"
import { exportCsv } from "./csv-exporter.js"
import { exportResultsJson, exportSummaryJson } from "./json-exporter.js"
import { generateMetricsPage } from "./metrics-page.js"
import { generateScenarioPage } from "./scenario-page.js"
import { generateSummaryPage } from "./summary-page.js"

export interface ReportOptions {
  readonly runId: string
  readonly rows: readonly ProfileRow[]
  readonly reportsDir: string
  readonly analysisResults?: readonly SessionAnalysisBundle[]
}

export async function generateReport(options: ReportOptions): Promise<string> {
  const { runId, rows, reportsDir, analysisResults } = options
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const reportDir = join(reportsDir, timestamp)
  const scenariosDir = join(reportDir, "scenarios")
  const dataDir = join(reportDir, "data")

  await mkdir(scenariosDir, { recursive: true })
  await mkdir(dataDir, { recursive: true })

  const scenarioIds = [...new Set(rows.map((r) => r.scenarioId))]

  await Promise.all([
    writeFile(join(reportDir, "index.md"), generateSummaryPage(rows, runId), "utf-8"),
    writeFile(join(reportDir, "metrics.md"), generateMetricsPage(rows), "utf-8"),
    writeFile(
      join(reportDir, "analysis.md"),
      generateAnalysisPage(rows, analysisResults ?? []),
      "utf-8",
    ),
    writeFile(join(reportDir, "comparison.md"), generateComparisonPage(rows), "utf-8"),
    ...scenarioIds.map((id) =>
      writeFile(
        join(scenariosDir, `${id}.md`),
        generateScenarioPage(
          rows.filter((r) => r.scenarioId === id),
          id,
        ),
        "utf-8",
      ),
    ),
    writeFile(join(dataDir, "results.csv"), exportCsv(rows), "utf-8"),
    writeFile(join(dataDir, "results.json"), exportResultsJson(rows), "utf-8"),
    writeFile(join(dataDir, "summary.json"), exportSummaryJson(rows, runId), "utf-8"),
  ])

  return reportDir
}

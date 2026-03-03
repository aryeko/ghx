import { readdir, readFile, rm } from "node:fs/promises"
import { join } from "node:path"

import type { ProfileRow, SessionAnalysisBundle } from "@ghx-dev/agent-profiler"
import { generateReport, readJsonlFile } from "@ghx-dev/agent-profiler"

export interface GenerateReportOptions {
  readonly runDir: string
  readonly resultsPaths: readonly string[]
  readonly outputDir: string
  readonly format: "all" | "md" | "csv" | "json"
}

interface ScenarioMetadataEntry {
  readonly id: string
  readonly name?: string
  readonly description?: string
}

async function loadAnalysisBundles(runDir: string): Promise<readonly SessionAnalysisBundle[]> {
  const analysisDir = join(runDir, "analysis")
  let scenarioDirs: string[]

  try {
    scenarioDirs = await readdir(analysisDir, { encoding: "utf-8" })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }

  const bundles: SessionAnalysisBundle[] = []

  for (const scenarioId of scenarioDirs) {
    const scenarioDir = join(analysisDir, scenarioId)
    let files: string[]
    try {
      files = (await readdir(scenarioDir, { encoding: "utf-8" })).filter((f) =>
        f.endsWith("-analysis.json"),
      )
    } catch {
      continue
    }

    for (const file of files) {
      try {
        const content = await readFile(join(scenarioDir, file), "utf-8")
        bundles.push(JSON.parse(content) as SessionAnalysisBundle)
      } catch {
        continue
      }
    }
  }

  return bundles
}

/**
 * Attempt to load scenario metadata (name, description) from scenario JSON files.
 * Looks in `./scenarios/` relative to CWD. Failures are silently ignored since
 * scenario metadata is optional enrichment.
 */
async function loadScenarioMetadata(
  scenarioIds: readonly string[],
): Promise<readonly ScenarioMetadataEntry[]> {
  const scenariosDir = join(process.cwd(), "scenarios")
  let files: string[]

  try {
    files = (await readdir(scenariosDir, { encoding: "utf-8" })).filter((f) => f.endsWith(".json"))
  } catch {
    return []
  }

  const metadata: ScenarioMetadataEntry[] = []
  const wantedIds = new Set(scenarioIds)

  for (const file of files) {
    try {
      const content = await readFile(join(scenariosDir, file), "utf-8")
      const parsed = JSON.parse(content) as { id?: string; name?: string; description?: string }
      if (typeof parsed.id === "string" && wantedIds.has(parsed.id)) {
        metadata.push({
          id: parsed.id,
          ...(typeof parsed.name === "string" ? { name: parsed.name } : {}),
          ...(typeof parsed.description === "string" ? { description: parsed.description } : {}),
        })
      }
    } catch {
      continue
    }
  }

  return metadata
}

/**
 * Loads JSONL result rows and optional analysis bundles, then generates
 * a full report via agent-profiler's generateReport().
 */
export async function generateEvalReport(options: GenerateReportOptions): Promise<string> {
  // Load rows from all JSONL paths
  const allRows: ProfileRow[] = []
  for (const path of options.resultsPaths) {
    const rows = await readJsonlFile(path, (line: string) => JSON.parse(line) as ProfileRow)
    allRows.push(...rows)
  }

  if (allRows.length === 0) {
    throw new Error("No profile rows found in the specified results file(s)")
  }

  // Extract runId from first row — safe after length check above
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const runId = allRows[0]!.runId

  // Load analysis bundles and scenario metadata in parallel
  const scenarioIds = [...new Set(allRows.map((r) => r.scenarioId))]
  const [analysisResults, scenarioMetadata] = await Promise.all([
    loadAnalysisBundles(options.runDir),
    loadScenarioMetadata(scenarioIds),
  ])

  // Generate report (spread optional fields only when non-empty to
  // satisfy exactOptionalPropertyTypes — the fields cannot be undefined)
  // Pass reportDir = outputDir so files land directly there instead of a timestamped subdir.
  const reportDir = await generateReport({
    runId,
    rows: allRows,
    reportsDir: options.outputDir,
    reportDir: options.outputDir,
    ...(analysisResults.length > 0 ? { analysisResults } : {}),
    ...(scenarioMetadata.length > 0 ? { scenarioMetadata } : {}),
  })

  // Format filtering: remove unwanted output files
  if (options.format !== "all") {
    if (options.format !== "csv") {
      await rm(join(reportDir, "data", "results.csv"), { force: true })
    }
    if (options.format !== "json") {
      await rm(join(reportDir, "data", "results.json"), { force: true })
      await rm(join(reportDir, "data", "summary.json"), { force: true })
    }
    if (options.format !== "md") {
      for (const mdFile of ["report.md", "analysis.md"]) {
        await rm(join(reportDir, mdFile), { force: true })
      }
    }
  }

  return reportDir
}

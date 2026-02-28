import { join } from "node:path"

import { generateEvalReport } from "@eval/report/generate.js"

import { parseFlag, parseFlagAll } from "./parse-flags.js"

export async function report(argv: readonly string[]): Promise<void> {
  const runId = parseFlag(argv, "--run-id")
  const runDir = runId ? join("reports", runId) : (parseFlag(argv, "--run-dir") ?? "results")
  const resultsPaths = parseFlagAll(argv, "--results")
  const VALID_FORMATS = ["all", "md", "csv", "json"] as const
  const rawFormat = parseFlag(argv, "--format") ?? "all"
  if (!VALID_FORMATS.includes(rawFormat as (typeof VALID_FORMATS)[number])) {
    throw new Error(`Invalid --format "${rawFormat}". Expected one of: ${VALID_FORMATS.join(", ")}`)
  }
  const format = rawFormat as (typeof VALID_FORMATS)[number]
  const outputDir = parseFlag(argv, "--output-dir") ?? runDir

  // Default results path: {results_dir}/{runId}.jsonl when --run-id given, else legacy fallback
  const paths =
    resultsPaths.length > 0
      ? resultsPaths
      : runId
        ? [join("results", `${runId}.jsonl`)]
        : [join(runDir, "results.jsonl")]

  console.log(`Generating report from ${paths.join(", ")}...`)

  const reportDir = await generateEvalReport({
    runDir,
    resultsPaths: paths,
    outputDir,
    format,
  })

  console.log(`Report generated at ${reportDir}`)
}

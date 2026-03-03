import { join } from "node:path"
import { generateEvalReport } from "@eval/report/generate.js"
import { Command } from "commander"

const VALID_FORMATS = ["all", "md", "csv", "json"] as const
type ReportFormat = (typeof VALID_FORMATS)[number]

function collectPaths(val: string, prev: string[]): string[] {
  return [...prev, val]
}

export function makeReportCommand(): Command {
  return new Command("report")
    .description("Generate formatted reports from evaluation results")
    .option("--run-id <id>", "run ID (derives run-dir as reports/<id>)")
    .option("--run-dir <path>", "directory containing run data", "results")
    .option("--results <path>", "results JSONL path (repeatable)", collectPaths, [] as string[])
    .option("--format <fmt>", "output format: all, md, csv, json", "all")
    .option("--output-dir <path>", "output directory for reports")
    .action(
      async (opts: {
        runId?: string
        runDir: string
        results: string[]
        format: string
        outputDir?: string
      }) => {
        if (!VALID_FORMATS.includes(opts.format as ReportFormat)) {
          throw new Error(
            `Invalid --format "${opts.format}". Expected one of: ${VALID_FORMATS.join(", ")}`,
          )
        }
        const format = opts.format as ReportFormat
        const runDir = opts.runId ? join("reports", opts.runId) : opts.runDir
        const outputDir = opts.outputDir ?? runDir

        const paths =
          opts.results.length > 0
            ? opts.results
            : opts.runId
              ? [join("results", `${opts.runId}.jsonl`)]
              : [join(runDir, "results.jsonl")]

        console.log(`Generating report from ${paths.join(", ")}...`)

        const reportDir = await generateEvalReport({
          runDir,
          resultsPaths: paths,
          outputDir,
          format,
        })

        console.log(`Report generated at ${reportDir}`)
      },
    )
}

export async function report(argv: readonly string[]): Promise<void> {
  await makeReportCommand().parseAsync([...argv], { from: "user" })
}

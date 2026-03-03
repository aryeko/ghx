import { join } from "node:path"
import { runAnalyzers } from "@eval/analysis/run-analyzers.js"
import { Command } from "commander"

export function makeAnalyzeCommand(): Command {
  return new Command("analyze")
    .description("Run post-processing analyzers on session data")
    .option("--run-id <id>", "run ID (derives run-dir as reports/<id>)")
    .option("--run-dir <path>", "directory containing session traces", "results")
    .option("--output <path>", "output directory for analysis results")
    .action(async (opts: { runId?: string; runDir: string; output?: string }) => {
      const runDir = opts.runId ? join("reports", opts.runId) : opts.runDir
      const outputDir = opts.output ?? join(runDir, "analysis")

      console.log(`Analyzing session traces in ${runDir}/sessions/...`)

      const bundles = await runAnalyzers({ runDir, outputDir })

      console.log(`Analysis complete: ${bundles.length} session(s) analyzed`)
      console.log(`Results written to ${outputDir}/`)
    })
}

export async function analyze(argv: readonly string[]): Promise<void> {
  await makeAnalyzeCommand().parseAsync([...argv], { from: "user" })
}

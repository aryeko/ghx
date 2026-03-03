import { resolve } from "node:path"
import { Command } from "commander"
import { makeAnalyzeCommand } from "./analyze.js"
import { makeCheckCommand } from "./check.js"
import { makeFixtureCommand } from "./fixture.js"
import { makeReportCommand } from "./report.js"
import { makeRunCommand } from "./run.js"

function loadEnvLocal(): void {
  try {
    /* v8 ignore next */
    process.loadEnvFile(resolve(import.meta.dirname ?? ".", "../../.env.local"))
  } catch {
    // .env.local is optional
  }
}

export function createProgram(): Command {
  return new Command("eval")
    .description("Evaluation harness for ghx agent sessions")
    .addCommand(makeRunCommand())
    .addCommand(makeAnalyzeCommand())
    .addCommand(makeReportCommand())
    .addCommand(makeCheckCommand())
    .addCommand(makeFixtureCommand())
}

// Only auto-execute when run directly (not when imported in tests)
const isDirectRun =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("index.ts") ||
    process.argv[1].endsWith("index.js") ||
    process.argv[1].includes("cli/index"))

if (isDirectRun) {
  loadEnvLocal()
  createProgram()
    .parseAsync(process.argv)
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    })
}

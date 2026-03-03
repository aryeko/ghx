import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { EvalConfigSchema } from "@eval/config/schema.js"
import { EvalScenarioSchema } from "@eval/scenario/schema.js"
import { Command } from "commander"
import { parse as parseYaml } from "yaml"

async function checkConfig(configPath: string): Promise<boolean> {
  try {
    const content = await readFile(configPath, "utf-8")
    const raw = parseYaml(content) as unknown
    EvalConfigSchema.parse(raw)
    console.log(`  ✓ ${configPath}`)
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.log(`  ✗ ${configPath}: ${message}`)
    return false
  }
}

async function checkScenarios(scenariosDir: string): Promise<boolean> {
  let allValid = true

  let files: string[]
  try {
    const entries = await readdir(scenariosDir)
    files = entries.filter((f) => f.endsWith(".json") && f !== "scenario-sets.json")
  } catch {
    return true
  }

  for (const file of files) {
    const filePath = join(scenariosDir, file)
    try {
      const content = await readFile(filePath, "utf-8")
      const raw = JSON.parse(content) as unknown
      EvalScenarioSchema.parse(raw)
      console.log(`  ✓ ${file}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`  ✗ ${file}: ${message}`)
      allValid = false
    }
  }

  return allValid
}

export function makeCheckCommand(): Command {
  return new Command("check")
    .description("Validate config and scenario files")
    .option("--config [path]", "validate config file (default: eval.config.yaml)")
    .option("--scenarios", "validate scenario files in ./scenarios/")
    .option("--all", "validate both config and scenarios")
    .action(async (opts: { config?: string | true; scenarios?: boolean; all?: boolean }) => {
      const hasConfig = opts.config !== undefined
      const hasScenarios = opts.scenarios === true
      const hasAll = opts.all === true

      if (!hasConfig && !hasScenarios && !hasAll) {
        console.error("Usage: eval check [--config [path]] [--scenarios] [--all]")
        process.exit(1)
      }

      let allValid = true

      if (hasConfig || hasAll) {
        const configPath = typeof opts.config === "string" ? opts.config : "eval.config.yaml"
        console.log("Checking config:")
        const valid = await checkConfig(configPath)
        if (!valid) allValid = false
      }

      if (hasScenarios || hasAll) {
        const scenariosDir = join(process.cwd(), "scenarios")
        console.log("Checking scenarios:")
        const valid = await checkScenarios(scenariosDir)
        if (!valid) allValid = false
      }

      if (!allValid) {
        process.exit(1)
      }
    })
}

export async function check(argv: readonly string[]): Promise<void> {
  await makeCheckCommand().parseAsync([...argv], { from: "user" })
}

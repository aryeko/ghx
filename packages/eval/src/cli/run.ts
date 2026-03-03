import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { GhxCollector } from "@eval/collector/ghx-collector.js"
import { loadEvalConfig } from "@eval/config/loader.js"
import type { EvalConfig } from "@eval/config/schema.js"
import { FixtureManager } from "@eval/fixture/manager.js"
import { loadFixtureManifest } from "@eval/fixture/manifest.js"
import { createEvalHooks } from "@eval/hooks/eval-hooks.js"
import { EvalModeResolver } from "@eval/mode/resolver.js"
import { OpenCodeProvider } from "@eval/provider/opencode-provider.js"
import { generateEvalReport } from "@eval/report/generate.js"
import { loadEvalScenarios, loadScenarioSets } from "@eval/scenario/loader.js"
import { CheckpointScorer } from "@eval/scorer/checkpoint-scorer.js"
import type { BaseScenario, SessionAnalysisBundle } from "@ghx-dev/agent-profiler"
import {
  efficiencyAnalyzer,
  errorAnalyzer,
  reasoningAnalyzer,
  runProfileSuite,
  strategyAnalyzer,
  toolPatternAnalyzer,
} from "@ghx-dev/agent-profiler"
import { Command, InvalidArgumentError } from "commander"

const BUILT_IN_ANALYZERS = [
  reasoningAnalyzer,
  strategyAnalyzer,
  efficiencyAnalyzer,
  toolPatternAnalyzer,
  errorAnalyzer,
]

function collect(val: string, prev: string[]): string[] {
  return [...prev, val]
}

interface RunOpts {
  config: string
  dryRun: boolean
  model: string[]
  mode: string[]
  scenario: string[]
  scenarioSet?: string
  repetitions?: number
  skipWarmup: boolean
  seedIfMissing: boolean
  outputJsonl?: string
}

function applyOptsOverrides(config: EvalConfig, opts: RunOpts): EvalConfig {
  let result: EvalConfig = config

  if (opts.model.length > 0) {
    result = {
      ...result,
      models: opts.model.map((id) => ({ id, label: id })),
    }
  }

  if (opts.mode.length > 0) {
    result = { ...result, modes: opts.mode as EvalConfig["modes"] }
  }

  if (opts.scenario.length > 0) {
    result = {
      ...result,
      scenarios: { ...result.scenarios, ids: [...opts.scenario] },
    }
  }

  if (opts.scenarioSet !== undefined) {
    result = {
      ...result,
      scenarios: { ...result.scenarios, set: opts.scenarioSet },
    }
  }

  if (opts.repetitions !== undefined) {
    result = { ...result, execution: { ...result.execution, repetitions: opts.repetitions } }
  }

  if (opts.skipWarmup) {
    result = {
      ...result,
      execution: { ...result.execution, warmup: false },
    }
  }

  if (opts.seedIfMissing) {
    result = {
      ...result,
      fixtures: { ...result.fixtures, seed_if_missing: true },
    }
  }

  return result
}

async function resolveScenarioIds(
  scenariosDir: string,
  scenarios: EvalConfig["scenarios"],
): Promise<readonly string[] | undefined> {
  if (scenarios.ids !== undefined && scenarios.ids.length > 0) {
    return scenarios.ids
  }
  if (scenarios.set !== undefined) {
    const sets = await loadScenarioSets(scenariosDir)
    const ids = sets[scenarios.set]
    if (ids === undefined) {
      throw new Error(`Scenario set "${scenarios.set}" not found in scenario-sets.json`)
    }
    return ids
  }
  return undefined
}

async function writeAnalysisBundles(
  bundles: readonly SessionAnalysisBundle[],
  reportsDir: string,
): Promise<void> {
  const iterCounters = new Map<string, number>()
  for (const bundle of bundles) {
    const key = `${bundle.scenarioId}:${bundle.mode}`
    const iter = iterCounters.get(key) ?? 0
    iterCounters.set(key, iter + 1)
    const dir = join(reportsDir, "analysis", bundle.scenarioId)
    await mkdir(dir, { recursive: true })
    await writeFile(
      join(dir, `${bundle.mode}-iter-${iter}-analysis.json`),
      JSON.stringify(bundle, null, 2),
      "utf-8",
    )
  }
}

export function makeRunCommand(): Command {
  return new Command("run")
    .description("Execute an evaluation run against configured models and scenarios")
    .option("--config <path>", "config file path", "config/eval.config.yaml")
    .option("--dry-run", "log resolved config and scenario count; skip execution")
    .option("--model <id>", "override model (repeatable)", collect, [] as string[])
    .option("--mode <name>", "override eval mode (repeatable)", collect, [] as string[])
    .option("--scenario <id>", "filter scenarios by ID (repeatable)", collect, [] as string[])
    .option("--scenario-set <name>", "select a pre-defined scenario set")
    .option("--repetitions <n>", "override repetition count", (value: string) => {
      const n = parseInt(value, 10)
      if (Number.isNaN(n)) throw new InvalidArgumentError("Not a number.")
      return n
    })
    .option("--skip-warmup", "disable warmup iterations")
    .option("--seed-if-missing", "auto-seed missing fixtures before run")
    .option("--output-jsonl <path>", "override results output file path")
    .action(async (opts: RunOpts) => {
      const yamlContent = await readFile(opts.config, "utf-8")
      const rawConfig = loadEvalConfig(yamlContent)
      const config = applyOptsOverrides(rawConfig, opts)

      const scenariosDir = join(process.cwd(), "scenarios")
      const manifest = await loadFixtureManifest(config.fixtures.manifest)

      if (opts.dryRun) {
        console.log("eval run --dry-run: resolved config:")
        console.log(JSON.stringify(config, null, 2))
        const resolvedIds = await resolveScenarioIds(scenariosDir, config.scenarios)
        const scenarios = await loadEvalScenarios(scenariosDir, resolvedIds, manifest)
        console.log(`Scenarios: ${scenarios.length}`)
        return
      }

      const runId = `run_${Date.now()}`

      const resolvedIds = await resolveScenarioIds(scenariosDir, config.scenarios)
      const scenarios = await loadEvalScenarios(scenariosDir, resolvedIds, manifest, {
        run_id: runId,
      })

      const rawScenariosList = await loadEvalScenarios(scenariosDir, resolvedIds)
      const rawScenariosMap = new Map(rawScenariosList.map((s) => [s.id, s]))

      const fixtureManager = new FixtureManager({
        repo: config.fixtures.repo,
        manifest: config.fixtures.manifest,
        seedIfMissing: config.fixtures.seed_if_missing,
      })

      const githubToken = process.env["GH_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? ""
      if (githubToken === "") {
        throw new Error('Missing GitHub token: set GH_TOKEN or GITHUB_TOKEN to run "eval run"')
      }

      const outputJsonlPath = opts.outputJsonl ?? join(config.output.results_dir, `${runId}.jsonl`)
      const reportsDir = join(config.output.reports_dir, runId)

      const allFixtureRequires = [...new Set(scenarios.flatMap((s) => s.fixture?.requires ?? []))]

      const hooks = createEvalHooks({
        fixtureManager,
        sessionExport: config.output.session_export,
        reportsDir,
        reseedBetweenModes: config.fixtures.reseed_between_modes,
        fixtureRequires: allFixtureRequires,
        rawScenarios: rawScenariosMap,
        runId,
      })

      for (const model of config.models) {
        const provider = new OpenCodeProvider({
          port: config.provider.port,
          model: model.id,
        })

        const result = await runProfileSuite({
          runId,
          model: model.id,
          modes: config.modes,
          scenarios: scenarios as unknown as ReadonlyArray<BaseScenario>,
          repetitions: config.execution.repetitions,
          allowedRetries: 0,
          outputJsonlPath,
          warmup: config.execution.warmup,
          sessionExport: config.output.session_export,
          logLevel: config.output.log_level,
          analyzers: BUILT_IN_ANALYZERS,
          provider,
          scorer: new CheckpointScorer(githubToken),
          modeResolver: new EvalModeResolver(),
          collectors: [new GhxCollector()],
          hooks,
        })

        if (result.analysisResults.length > 0) {
          await writeAnalysisBundles(result.analysisResults, reportsDir)
        }

        await generateEvalReport({
          runDir: reportsDir,
          resultsPaths: [outputJsonlPath],
          outputDir: reportsDir,
          format: "all",
        })

        console.log(`Run complete. Results: ${outputJsonlPath}`)
        console.log(`Reports: ${reportsDir}/`)
      }
    })
}

export async function run(argv: readonly string[]): Promise<void> {
  await makeRunCommand().parseAsync([...argv], { from: "user" })
}

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
import { hasFlag, parseFlag, parseFlagAll } from "./parse-flags.js"

const BUILT_IN_ANALYZERS = [
  reasoningAnalyzer,
  strategyAnalyzer,
  efficiencyAnalyzer,
  toolPatternAnalyzer,
  errorAnalyzer,
]

function applyFlagOverrides(config: EvalConfig, argv: readonly string[]): EvalConfig {
  let result: EvalConfig = config

  const models = parseFlagAll(argv, "--model")
  if (models.length > 0) {
    result = {
      ...result,
      models: models.map((id) => ({ id, label: id })),
    }
  }

  const modes = parseFlagAll(argv, "--mode")
  if (modes.length > 0) {
    result = { ...result, modes: modes as EvalConfig["modes"] }
  }

  const scenarioIds = parseFlagAll(argv, "--scenario")
  if (scenarioIds.length > 0) {
    result = {
      ...result,
      scenarios: { ...result.scenarios, ids: [...scenarioIds] },
    }
  }

  const scenarioSet = parseFlag(argv, "--scenario-set")
  if (scenarioSet !== null) {
    result = {
      ...result,
      scenarios: { ...result.scenarios, set: scenarioSet },
    }
  }

  const repStr = parseFlag(argv, "--repetitions")
  if (repStr !== null) {
    const repetitions = Number(repStr)
    if (!Number.isNaN(repetitions) && repetitions > 0) {
      result = { ...result, execution: { ...result.execution, repetitions } }
    } else {
      console.warn(`Warning: invalid --repetitions value "${repStr}", using config default`)
    }
  }

  if (hasFlag(argv, "--skip-warmup")) {
    result = {
      ...result,
      execution: { ...result.execution, warmup: false },
    }
  }

  if (hasFlag(argv, "--seed-if-missing")) {
    result = {
      ...result,
      fixtures: { ...result.fixtures, seed_if_missing: true },
    }
  }

  // --output-jsonl sets the output path for runProfileSuite (overrides config.output.results_dir)
  // The agent-profiler will write results to this path
  const outputJsonl = parseFlag(argv, "--output-jsonl")
  if (outputJsonl !== null) {
    result = {
      ...result,
      output: { ...result.output, results_dir: outputJsonl },
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

export async function run(argv: readonly string[]): Promise<void> {
  const configPath = parseFlag(argv, "--config") ?? "eval.config.yaml"
  const yamlContent = await readFile(configPath, "utf-8")
  const rawConfig = loadEvalConfig(yamlContent)
  const config = applyFlagOverrides(rawConfig, argv)

  const scenariosDir = join(process.cwd(), "scenarios")

  const manifest = await loadFixtureManifest(config.fixtures.manifest)

  if (hasFlag(argv, "--dry-run")) {
    console.log("eval run --dry-run: resolved config:")
    console.log(JSON.stringify(config, null, 2))
    const resolvedIds = await resolveScenarioIds(scenariosDir, config.scenarios)
    const scenarios = await loadEvalScenarios(scenariosDir, resolvedIds, manifest)
    console.log(`Scenarios: ${scenarios.length}`)
    return
  }

  const resolvedIds = await resolveScenarioIds(scenariosDir, config.scenarios)
  const scenarios = await loadEvalScenarios(scenariosDir, resolvedIds, manifest)

  const fixtureManager = new FixtureManager({
    repo: config.fixtures.repo,
    manifest: config.fixtures.manifest,
    seedIfMissing: config.fixtures.seed_if_missing,
  })

  const githubToken = process.env["GH_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? ""
  if (githubToken === "") {
    throw new Error('Missing GitHub token: set GH_TOKEN or GITHUB_TOKEN to run "eval run"')
  }

  const runId = `run_${Date.now()}`
  // --output-jsonl specifies a direct file path; otherwise use {results_dir}/{runId}.jsonl
  const outputJsonlOverride = parseFlag(argv, "--output-jsonl")
  const outputJsonlPath = outputJsonlOverride ?? join(config.output.results_dir, `${runId}.jsonl`)
  const reportsDir = join(config.output.reports_dir, runId)

  const allFixtureRequires = [...new Set(scenarios.flatMap((s) => s.fixture?.requires ?? []))]

  const hooks = createEvalHooks({
    fixtureManager,
    sessionExport: config.output.session_export,
    reportsDir,
    reseedBetweenModes: config.fixtures.reseed_between_modes,
    fixtureRequires: allFixtureRequires,
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
      // EvalScenario extends BaseScenario structurally; cast required due to module boundary
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
}

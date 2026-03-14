import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { FixtureManager } from "@eval/fixture/manager.js"
import type { FixtureResource } from "@eval/fixture/manifest.js"
import { bindFixtureVariables } from "@eval/scenario/fixture-binder.js"
import type { EvalScenario } from "@eval/scenario/schema.js"
import type {
  AfterScenarioContext,
  BaseScenario,
  RunContext,
  RunHooks,
  SessionTrace,
} from "@ghx-dev/agent-profiler"

/**
 * Options for {@link createEvalHooks}.
 */
export interface EvalHooksOptions {
  /** Manages GitHub fixture state (status checks and branch resets). */
  readonly fixtureManager: FixtureManager
  /** When `true`, write session trace JSON files to `reportsDir/sessions/` after each scenario. */
  readonly sessionExport: boolean
  /** Directory for session trace exports. Defaults to `"reports"`. */
  readonly reportsDir?: string
  /** When `true`, reset all fixtures to their original state before each mode begins. */
  readonly reseedBetweenModes?: boolean
  /** Fixture names to reset when `reseedBetweenModes` is true. */
  readonly fixtureRequires?: readonly string[]
  /** Run ID injected as `{{run_id}}` in scenario prompts. */
  readonly runId?: string
  /**
   * Map of scenario ID → raw (unbound) scenario template.
   *
   * Required to support `fixture.seedPerIteration = true`. When a fresh fixture is
   * seeded before an iteration, the hook re-runs `bindFixtureVariables` against the
   * raw template so the prompt and checkpoint inputs receive the new PR number.
   */
  readonly rawScenarios?: ReadonlyMap<string, EvalScenario>
  /** Optional judge provider for LLM-as-judge lifecycle management. */
  readonly judgeProvider?: {
    init(): Promise<void>
    shutdown(): Promise<void>
  }
}

/**
 * Creates a `RunHooks` object that wires fixture management and session trace
 * export into the profiler run lifecycle.
 *
 * - **`beforeRun`** — asserts all required fixtures exist in the manifest;
 *   throws with a list of missing fixture names if any are absent.
 * - **`beforeMode`** — resets all fixtures to their original state when
 *   `reseedBetweenModes` is `true`.
 * - **`beforeScenario`** — resets fixtures to their original state when the
 *   scenario sets `fixture.reseedPerIteration = true`; seeds a fresh fixture PR
 *   and returns a rebound scenario when `fixture.seedPerIteration = true`.
 * - **`afterScenario`** — persists the session trace to the output directory
 *   when `sessionExport` is enabled.
 *
 * @param options.fixtureManager - Manages GitHub fixture state
 * @param options.sessionExport - When `true`, write session traces to disk
 * @returns `RunHooks` object for use in `runProfileSuite`
 *
 * @example
 * ```typescript
 * import { createEvalHooks, FixtureManager } from "@ghx-dev/eval"
 *
 * const hooks = createEvalHooks({
 *   fixtureManager: new FixtureManager({
 *     repo: "owner/fixtures",
 *     manifest: "fixtures/latest.json",
 *   }),
 *   sessionExport: true,
 * })
 * ```
 */
export function createEvalHooks(options: EvalHooksOptions): RunHooks {
  // Tracks per-iteration seeded resources for cleanup in afterScenario.
  // Key: `${scenarioId}:${mode}:${iteration}`
  const iterationResources = new Map<string, readonly FixtureResource[]>()

  const baseHooks: RunHooks = {
    beforeRun: async (_ctx: RunContext) => {
      const status = await options.fixtureManager.status()
      if (status.missing.length > 0) {
        throw new Error(
          `Missing fixtures before run: ${status.missing.join(", ")}. Run "eval fixture seed" first.`,
        )
      }
      if (options.judgeProvider) {
        await options.judgeProvider.init()
      }
    },

    beforeMode: async (_mode: string) => {
      if (
        options.reseedBetweenModes &&
        options.fixtureRequires &&
        options.fixtureRequires.length > 0
      ) {
        await options.fixtureManager.reset(options.fixtureRequires)
      }
    },

    beforeScenario: async (ctx): Promise<BaseScenario | undefined> => {
      const scenario = ctx.scenario as unknown as EvalScenario

      if (scenario.fixture?.reseedPerIteration) {
        await options.fixtureManager.reset(scenario.fixture.requires)
      }

      if (scenario.fixture?.seedPerIteration) {
        const rawScenario = options.rawScenarios?.get(scenario.id)
        if (!rawScenario?.fixture) return

        const newFixtures: Record<string, Record<string, unknown>> = {}
        for (const fixtureName of rawScenario.fixture.requires) {
          const resource = await options.fixtureManager.seedOne(fixtureName)
          newFixtures[fixtureName] = resource as unknown as Record<string, unknown>
        }

        const resources = Object.values(newFixtures) as FixtureResource[]
        iterationResources.set(`${scenario.id}:${ctx.mode}:${ctx.iteration}`, resources)

        const miniManifest = { fixtures: newFixtures }
        const extraVars = options.runId ? { run_id: options.runId } : undefined
        return bindFixtureVariables(rawScenario, miniManifest, extraVars) as unknown as BaseScenario
      }
    },

    afterScenario: async (ctx: AfterScenarioContext) => {
      if (options.sessionExport && ctx.trace) {
        await exportSessionTrace(
          ctx.trace,
          ctx.scenario.id,
          ctx.mode,
          ctx.iteration,
          options.reportsDir ?? "reports",
        )
      }

      const key = `${ctx.scenario.id}:${ctx.mode}:${ctx.iteration}`
      const resources = iterationResources.get(key)
      if (resources) {
        iterationResources.delete(key)
        for (const resource of resources) {
          try {
            await options.fixtureManager.closeResource(resource)
          } catch {
            // best-effort: don't fail the run if cleanup fails
          }
        }
      }
    },
  }

  if (!options.judgeProvider) {
    return baseHooks
  }

  const { judgeProvider } = options

  return {
    ...baseHooks,
    afterRun: async (ctx: RunContext) => {
      await baseHooks.afterRun?.(ctx)
      await judgeProvider.shutdown()
    },
  }
}

async function exportSessionTrace(
  trace: SessionTrace,
  scenarioId: string,
  mode: string,
  iteration: number,
  reportsDir: string,
): Promise<void> {
  const dir = join(reportsDir, "sessions", scenarioId)
  await mkdir(dir, { recursive: true })
  const filename = `${mode}-iter-${iteration}.json`
  await writeFile(join(dir, filename), JSON.stringify(trace, null, 2), "utf-8")
}

import type { ProfileRow } from "../types/profile-row.js"
import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace } from "../types/trace.js"

export interface BeforeScenarioContext {
  readonly scenario: BaseScenario
  readonly mode: string
  readonly model: string
  readonly iteration: number
}

export interface AfterScenarioContext extends BeforeScenarioContext {
  readonly result: ProfileRow
  readonly trace: SessionTrace | null
}

export interface RunContext {
  readonly runId: string
  readonly modes: readonly string[]
  readonly scenarios: readonly BaseScenario[]
  readonly repetitions: number
}

export type RunHooks = {
  readonly beforeScenario?: (ctx: BeforeScenarioContext) => Promise<void>
  readonly afterScenario?: (ctx: AfterScenarioContext) => Promise<void>
  readonly beforeMode?: (mode: string) => Promise<void>
  readonly afterMode?: (mode: string) => Promise<void>
  readonly beforeRun?: (ctx: RunContext) => Promise<void>
  readonly afterRun?: (ctx: RunContext) => Promise<void>
}

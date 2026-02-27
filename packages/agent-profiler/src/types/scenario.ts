export interface BaseScenario {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly prompt: string
  readonly timeoutMs: number
  readonly allowedRetries: number
  readonly tags: readonly string[]
  readonly extensions: Readonly<Record<string, unknown>>
}

export type ScenarioSets = Readonly<Record<string, readonly string[]>>

export type ScenarioLoader = (ids: readonly string[]) => Promise<readonly BaseScenario[]>

export interface ProgressEvent {
  readonly type: "scenario_start" | "scenario_end" | "iteration_start" | "iteration_end"
  readonly scenarioId: string
  readonly mode: string
  readonly iteration: number
  readonly timestamp: string
}

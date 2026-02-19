import type { BenchmarkMode, WorkflowScenario } from "../../domain/types.js"

export function renderWorkflowPrompt(scenario: WorkflowScenario, _mode: BenchmarkMode): string {
  return scenario.prompt
}

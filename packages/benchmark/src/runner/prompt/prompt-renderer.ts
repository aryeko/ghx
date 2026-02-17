import type { BenchmarkMode, WorkflowScenario } from "../../domain/types.js"

export function renderWorkflowPrompt(scenario: WorkflowScenario, mode: BenchmarkMode): string {
  const modeHint =
    mode === "ghx"
      ? "You MUST use `ghx run <task> --input - <<'EOF'\n<json>\nEOF` commands to interact with GitHub. Do not use raw `gh` CLI or API calls. Run `ghx capabilities` if you need to discover available tasks."
      : mode === "agent_direct"
        ? "Use GitHub CLI (`gh`) commands directly. Do not use `ghx`."
        : ""

  return modeHint.length > 0 ? `${modeHint}\n\n${scenario.prompt}` : scenario.prompt
}

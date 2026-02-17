import { describe, expect, it } from "vitest"
import type { WorkflowScenario } from "../../src/domain/types.js"
import { renderWorkflowPrompt } from "../../src/runner/prompt/prompt-renderer.js"

const workflowScenario: WorkflowScenario = {
  type: "workflow",
  id: "test-wf-001",
  name: "Test workflow",
  prompt: "Fix the review comments on PR #42.",
  expected_capabilities: ["pr.comment.resolve"],
  timeout_ms: 180_000,
  allowed_retries: 1,
  assertions: {
    expected_outcome: "success",
    checkpoints: [],
  },
  tags: ["workflow"],
}

describe("renderWorkflowPrompt", () => {
  it("prepends ghx mode instructions", () => {
    const result = renderWorkflowPrompt(workflowScenario, "ghx")

    expect(result).toContain("ghx run <task>")
    expect(result).toContain("Do not use raw `gh` CLI")
    expect(result).toContain("Fix the review comments on PR #42.")
  })

  it("prepends agent_direct mode instructions", () => {
    const result = renderWorkflowPrompt(workflowScenario, "agent_direct")

    expect(result).toContain("Use GitHub CLI (`gh`) commands directly")
    expect(result).toContain("Do not use `ghx`")
    expect(result).toContain("Fix the review comments on PR #42.")
  })

  it("returns bare prompt for mcp mode", () => {
    const result = renderWorkflowPrompt(workflowScenario, "mcp")

    expect(result).toBe("Fix the review comments on PR #42.")
  })
})

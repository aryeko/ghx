import { describe, expect, it } from "vitest"

import { validateScenario } from "../../src/scenario/schema.js"

function createValidScenario(): Record<string, unknown> {
  return {
    id: "repo-view-001",
    name: "Repo view",
    task: "repo.view",
    input: {
      owner: "aryeko",
      name: "ghx-bench-fixtures",
    },
    prompt_template: "Execute task {{task}} with {{input_json}}",
    timeout_ms: 60_000,
    allowed_retries: 0,
    fixture: {
      repo: "aryeko/ghx-bench-fixtures",
      bindings: {
        "input.owner": "repo.owner",
      },
    },
    assertions: {
      must_succeed: true,
    },
    tags: ["repo", "view"],
  }
}

describe("scenario schema validation", () => {
  it("requires either expected_outcome or must_succeed", () => {
    const scenario = createValidScenario()
    scenario.assertions = {}
    expect(() => validateScenario(scenario)).toThrow(
      "either expected_outcome or must_succeed must be provided",
    )
  })

  it("rejects conflicting expected_outcome and must_succeed", () => {
    const scenario = createValidScenario()
    scenario.assertions = {
      expected_outcome: "expected_error",
      must_succeed: true,
    }
    expect(() => validateScenario(scenario)).toThrow("expected_outcome conflicts with must_succeed")
  })

  it("requires expected_error_code when expected_outcome is expected_error", () => {
    const scenario = createValidScenario()
    scenario.assertions = {
      expected_outcome: "expected_error",
    }
    expect(() => validateScenario(scenario)).toThrow(
      "expected_error scenarios must specify expected_error_code",
    )
  })

  it("accepts expected_error scenarios with expected_error_code", () => {
    const scenario = createValidScenario()
    scenario.assertions = {
      expected_outcome: "expected_error",
      expected_error_code: "NOT_FOUND",
    }

    expect(() => validateScenario(scenario)).not.toThrow()
  })

  it("rejects fixture bindings with non-dotted source paths", () => {
    const scenario = createValidScenario()
    scenario.fixture = {
      repo: "aryeko/ghx-bench-fixtures",
      bindings: {
        "input.owner": "owner",
      },
    }

    expect(() => validateScenario(scenario)).toThrow(
      "fixture binding source must be a dotted manifest path",
    )
  })

  it("rejects fixture bindings with destination paths outside input", () => {
    const scenario = createValidScenario()
    scenario.fixture = {
      repo: "aryeko/ghx-bench-fixtures",
      bindings: {
        owner: "repo.owner",
      },
    }

    expect(() => validateScenario(scenario)).toThrow(
      "fixture binding destination must start with 'input.'",
    )
  })

  it("accepts fixture config when bindings are omitted", () => {
    const scenario = createValidScenario()
    scenario.fixture = {
      repo: "aryeko/ghx-bench-fixtures",
      branch: "main",
    }

    expect(() => validateScenario(scenario)).not.toThrow()
  })

  it("accepts assertions using expected_outcome without must_succeed", () => {
    const scenario = createValidScenario()
    scenario.assertions = {
      expected_outcome: "success",
      require_tool_calls: true,
      min_tool_calls: 0,
      max_tool_calls: 2,
    }

    expect(() => validateScenario(scenario)).not.toThrow()
  })

  it("rejects max_tool_calls values below min_tool_calls", () => {
    const scenario = createValidScenario()
    scenario.assertions = {
      must_succeed: true,
      min_tool_calls: 2,
      max_tool_calls: 1,
    }

    expect(() => validateScenario(scenario)).toThrow(
      "max_tool_calls must be greater than or equal to min_tool_calls",
    )
  })
})

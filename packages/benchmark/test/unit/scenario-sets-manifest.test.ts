import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

function loadScenarioSets(): Record<string, string[]> {
  const manifestPath = resolve(__dirname, "../../scenario-sets.json")
  return JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, string[]>
}

describe("scenario-sets manifest", () => {
  it("keeps default set equal to all workflow scenarios", () => {
    const scenarioSets = loadScenarioSets()

    expect(scenarioSets.default).toEqual([
      "pr-fix-review-comments-wf-001",
      "issue-triage-comment-wf-001",
      "pr-review-comment-wf-001",
      "ci-diagnose-run-wf-001",
    ])
  })

  it("defines workflows set matching default", () => {
    const scenarioSets = loadScenarioSets()

    expect(scenarioSets.workflows).toEqual(scenarioSets.default)
  })

  it("defines all as equal to workflows", () => {
    const scenarioSets = loadScenarioSets()

    expect(new Set(scenarioSets.all ?? [])).toEqual(new Set(scenarioSets.workflows ?? []))
  })

  it("defines full-seeded as equal to all", () => {
    const scenarioSets = loadScenarioSets()

    expect(new Set(scenarioSets["full-seeded"] ?? [])).toEqual(new Set(scenarioSets.all ?? []))
  })
})

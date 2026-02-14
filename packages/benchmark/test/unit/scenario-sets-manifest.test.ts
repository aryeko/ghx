import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

function loadScenarioSets(): Record<string, string[]> {
  const manifestPath = join(process.cwd(), "scenario-sets.json")
  return JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, string[]>
}

describe("scenario-sets manifest", () => {
  it("keeps default set stable and mutation-free", () => {
    const sets = loadScenarioSets()

    expect(sets.default).toEqual([
      "repo-view-001",
      "issue-view-001",
      "issue-list-open-001",
      "issue-comments-list-001",
      "pr-view-001",
      "pr-list-open-001"
    ])
  })

  it("includes roadmap batch C release and delivery set", () => {
    const sets = loadScenarioSets()

    expect(sets["roadmap-batch-c-release-delivery"]).toEqual([
      "batch-c-release-list-001",
      "batch-c-release-get-001",
      "batch-c-release-create-draft-001",
      "batch-c-release-update-001",
      "batch-c-release-publish-draft-001",
      "batch-c-workflow-dispatch-run-001",
      "batch-c-workflow-run-rerun-failed-001"
    ])
  })
})

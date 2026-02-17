import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { loadScenarioSets, loadScenarios } from "../../src/scenario/loader.js"

describe("loadScenarios", () => {
  it("loads and sorts valid scenario files", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-scenarios-"))
    await mkdir(root, { recursive: true })

    const s1 = {
      type: "workflow",
      id: "batch-z-loader-b-wf-001",
      name: "Scenario B",
      prompt: "Do something with repository B.",
      expected_capabilities: ["repo.view"],
      timeout_ms: 1000,
      allowed_retries: 0,
      assertions: {
        expected_outcome: "success",
        checkpoints: [
          {
            name: "check",
            verification_task: "repo.view",
            verification_input: { owner: "a", name: "b" },
            condition: "non_empty",
          },
        ],
      },
      tags: [],
    }
    const s2 = { ...s1, id: "batch-z-loader-a-wf-001", name: "Scenario A" }

    await writeFile(join(root, "b.json"), JSON.stringify(s1), "utf8")
    await writeFile(join(root, "a.json"), JSON.stringify(s2), "utf8")
    await writeFile(join(root, "README.txt"), "ignore", "utf8")

    const scenarios = await loadScenarios(root)
    expect(scenarios.map((s) => s.id)).toEqual([
      "batch-z-loader-a-wf-001",
      "batch-z-loader-b-wf-001",
    ])
  })

  it("loads scenario sets manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-scenario-sets-"))
    await mkdir(root, { recursive: true })

    const manifest = {
      default: ["repo-view-001"],
      "pr-operations-all": ["repo-view-001", "pr-view-001"],
    }

    await writeFile(join(root, "scenario-sets.json"), JSON.stringify(manifest), "utf8")

    const sets = await loadScenarioSets(root)
    expect(sets).toEqual(manifest)
  })

  it("throws when scenario set manifest is not an object", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-scenario-sets-invalid-root-"))
    await mkdir(root, { recursive: true })
    await writeFile(join(root, "scenario-sets.json"), JSON.stringify(["default"]), "utf8")

    await expect(loadScenarioSets(root)).rejects.toThrow(
      "Invalid scenario-sets manifest: expected object",
    )
  })

  it("throws when scenario set contains non-string ids", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-scenario-sets-invalid-ids-"))
    await mkdir(root, { recursive: true })
    await writeFile(
      join(root, "scenario-sets.json"),
      JSON.stringify({ default: ["repo-view-001", 123], "pr-operations-all": ["repo-view-001"] }),
      "utf8",
    )

    await expect(loadScenarioSets(root)).rejects.toThrow(
      "Invalid scenario-sets manifest: set 'default' must be an array of non-empty scenario ids",
    )
  })
})

import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { loadFixtureManifest, resolveScenarioFixtureBindings } from "../../src/fixture/manifest.js"
import type { Scenario } from "../../src/domain/types.js"

describe("fixture manifest", () => {
  it("loads and validates fixture manifest", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-manifest-"))
    const path = join(root, "fixtures.json")
    await writeFile(
      path,
      JSON.stringify({
        version: 1,
        repo: {
          owner: "aryeko",
          name: "ghx-bench-fixtures",
          full_name: "aryeko/ghx-bench-fixtures",
          default_branch: "main"
        },
        resources: {
          pr: {
            number: 12
          }
        }
      }),
      "utf8"
    )

    const manifest = await loadFixtureManifest(path)
    expect(manifest.repo.full_name).toBe("aryeko/ghx-bench-fixtures")
  })

  it("resolves scenario input values from fixture bindings", () => {
    const scenario: Scenario = {
      id: "pr-view-001",
      name: "PR view",
      task: "pr.view",
      input: {
        owner: "OWNER_PLACEHOLDER",
        name: "REPO_PLACEHOLDER",
        prNumber: 0
      },
      prompt_template: "x",
      timeout_ms: 1000,
      allowed_retries: 0,
      fixture: {
        bindings: {
          "input.owner": "repo.owner",
          "input.name": "repo.name",
          "input.prNumber": "resources.pr.number"
        }
      },
      assertions: {
        must_succeed: true
      },
      tags: []
    }

    const resolved = resolveScenarioFixtureBindings(scenario, {
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main"
      },
      resources: {
        pr: {
          number: 12
        }
      }
    })

    expect(resolved.input.owner).toBe("aryeko")
    expect(resolved.input.name).toBe("ghx-bench-fixtures")
    expect(resolved.input.prNumber).toBe(12)
  })
})

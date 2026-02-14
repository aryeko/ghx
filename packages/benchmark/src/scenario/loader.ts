import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import type { Scenario } from "../domain/types.js"
import { validateScenario } from "./schema.js"

export async function loadScenarios(scenariosDir: string): Promise<Scenario[]> {
  const files = await readdir(scenariosDir)
  const scenarioFiles = files.filter((file) => file.endsWith(".json"))

  const scenarios = await Promise.all(
    scenarioFiles.map(async (file) => {
      const raw = await readFile(join(scenariosDir, file), "utf8")
      return validateScenario(JSON.parse(raw))
    })
  )

  return scenarios.sort((a, b) => a.id.localeCompare(b.id))
}

export async function loadScenarioSets(benchmarkRootDir: string): Promise<Record<string, string[]>> {
  const raw = await readFile(join(benchmarkRootDir, "scenario-sets.json"), "utf8")
  const parsed = JSON.parse(raw)

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Invalid scenario-sets manifest: expected object")
  }

  const entries = Object.entries(parsed)
  for (const [setName, scenarioIds] of entries) {
    if (!Array.isArray(scenarioIds) || scenarioIds.some((scenarioId) => typeof scenarioId !== "string" || scenarioId.length === 0)) {
      throw new Error(`Invalid scenario-sets manifest: set '${setName}' must be an array of non-empty scenario ids`)
    }
  }

  return parsed as Record<string, string[]>
}

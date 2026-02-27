import { readFile } from "node:fs/promises"
import { loadEvalConfig } from "@eval/config/loader.js"
import { FixtureManager } from "@eval/fixture/manager.js"
import { loadEvalScenarios } from "@eval/scenario/loader.js"
import { hasFlag, parseFlag } from "./parse-flags.js"

export async function fixture(argv: readonly string[]): Promise<void> {
  const subcommand = argv[0]

  if (!subcommand || !["seed", "status", "cleanup"].includes(subcommand)) {
    console.error(
      "Usage: eval fixture <seed|status|cleanup> [--repo <owner/name>] [--manifest <path>] [--seed-id <id>] [--dry-run] [--all]",
    )
    process.exit(1)
  }

  const repo = parseFlag(argv, "--repo") ?? process.env["EVAL_FIXTURE_REPO"] ?? ""

  const manifest =
    parseFlag(argv, "--manifest") ?? process.env["EVAL_FIXTURE_MANIFEST"] ?? "fixtures/latest.json"

  const seedId = parseFlag(argv, "--seed-id") ?? "default"
  const dryRun = hasFlag(argv, "--dry-run")

  const manager = new FixtureManager({ repo, manifest, seedId })

  if (subcommand === "seed") {
    const configPath = parseFlag(argv, "--config") ?? "config/eval.config.yaml"
    const yamlContent = await readFile(configPath, "utf-8")
    const config = loadEvalConfig(yamlContent)

    const scenariosDir = (config.scenarios as Record<string, unknown> | undefined)?.["directory"] as
      | string
      | undefined
    const resolvedDir = scenariosDir ?? "scenarios"

    const scenarios = await loadEvalScenarios(resolvedDir)

    if (dryRun) {
      const uniqueRequires = new Set<string>()
      for (const s of scenarios) {
        if (s.fixture) {
          for (const r of s.fixture.requires) {
            uniqueRequires.add(r)
          }
        }
      }
      console.log("Dry-run: fixture requirements collected from scenarios:")
      for (const req of uniqueRequires) {
        console.log(`  - ${req}`)
      }
      return
    }

    await manager.seed(
      scenarios as readonly { readonly fixture?: { readonly requires: readonly string[] } }[],
    )
    console.log("Fixture seeding complete.")
    return
  }

  if (subcommand === "status") {
    const status = await manager.status()
    console.log(`Fixture status:`)
    if (status.ok.length > 0) {
      console.log(`  ok: ${status.ok.join(", ")}`)
    }
    if (status.missing.length > 0) {
      console.log(`  missing: ${status.missing.join(", ")}`)
    }
    if (status.ok.length === 0 && status.missing.length === 0) {
      console.log("  no fixtures found")
    }
    return
  }

  if (subcommand === "cleanup") {
    const all = argv.includes("--all")
    await manager.cleanup({ all })
    console.log("Fixture cleanup complete.")
    return
  }
}

import { readFile } from "node:fs/promises"
import { loadEvalConfig } from "@eval/config/loader.js"
import { FixtureManager } from "@eval/fixture/manager.js"
import { loadEvalScenarios } from "@eval/scenario/loader.js"
import { Command } from "commander"

function makeSeedCommand(): Command {
  return new Command("seed")
    .description("Seed fixtures required by scenarios")
    .option("--repo <owner/name>", "repository to seed", process.env["EVAL_FIXTURE_REPO"] ?? "")
    .option(
      "--manifest <path>",
      "fixture manifest path",
      process.env["EVAL_FIXTURE_MANIFEST"] ?? "fixtures/latest.json",
    )
    .option("--seed-id <id>", "seed identifier", "default")
    .option("--config <path>", "eval config path", "config/eval.config.yaml")
    .option("--dry-run", "print fixture requirements without seeding")
    .action(
      async (opts: {
        repo: string
        manifest: string
        seedId: string
        config: string
        dryRun: boolean
      }) => {
        const manager = new FixtureManager({
          repo: opts.repo,
          manifest: opts.manifest,
          seedId: opts.seedId,
        })
        const yamlContent = await readFile(opts.config, "utf-8")
        const config = loadEvalConfig(yamlContent)
        const scenarioIds = config.scenarios.ids ?? undefined
        const scenarios = await loadEvalScenarios("scenarios", scenarioIds)

        if (opts.dryRun) {
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
      },
    )
}

function makeStatusCommand(): Command {
  return new Command("status")
    .description("Show fixture status")
    .option("--repo <owner/name>", "repository", process.env["EVAL_FIXTURE_REPO"] ?? "")
    .option(
      "--manifest <path>",
      "fixture manifest path",
      process.env["EVAL_FIXTURE_MANIFEST"] ?? "fixtures/latest.json",
    )
    .action(async (opts: { repo: string; manifest: string }) => {
      const manager = new FixtureManager({ repo: opts.repo, manifest: opts.manifest })
      const status = await manager.status()
      console.log("Fixture status:")
      if (status.ok.length > 0) {
        console.log(`  ok: ${status.ok.join(", ")}`)
      }
      if (status.missing.length > 0) {
        console.log(`  missing: ${status.missing.join(", ")}`)
      }
      if (status.ok.length === 0 && status.missing.length === 0) {
        console.log("  no fixtures found")
      }
    })
}

function makeCleanupCommand(): Command {
  return new Command("cleanup")
    .description("Clean up fixtures")
    .option("--repo <owner/name>", "repository", process.env["EVAL_FIXTURE_REPO"] ?? "")
    .option(
      "--manifest <path>",
      "fixture manifest path",
      process.env["EVAL_FIXTURE_MANIFEST"] ?? "fixtures/latest.json",
    )
    .option("--all", "clean up all fixtures")
    .action(async (opts: { repo: string; manifest: string; all?: boolean }) => {
      const manager = new FixtureManager({ repo: opts.repo, manifest: opts.manifest })
      await manager.cleanup({ all: opts.all ?? false })
      console.log("Fixture cleanup complete.")
    })
}

export function makeFixtureCommand(): Command {
  const cmd = new Command("fixture").description("Manage test fixtures")

  cmd.addCommand(makeSeedCommand())
  cmd.addCommand(makeStatusCommand())
  cmd.addCommand(makeCleanupCommand())

  cmd.action(() => {
    console.error("Usage: eval fixture <seed|status|cleanup> [options]")
    process.exit(1)
  })

  return cmd
}

export async function fixture(argv: readonly string[]): Promise<void> {
  await makeFixtureCommand().parseAsync([...argv], { from: "user" })
}

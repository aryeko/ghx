import { FixtureManager } from "@eval/fixture/manager.js"

function parseFlag(argv: readonly string[], flag: string): string | null {
  const idx = argv.indexOf(flag)
  if (idx === -1 || idx + 1 >= argv.length) return null
  const next = argv[idx + 1]
  if (next === undefined || next.startsWith("--")) return null
  return next
}

export async function fixture(argv: readonly string[]): Promise<void> {
  const subcommand = argv[0]

  if (!subcommand || !["seed", "status", "cleanup"].includes(subcommand)) {
    console.error(
      "Usage: eval fixture <seed|status|cleanup> [--repo <owner/name>] [--manifest <path>] [--all]",
    )
    process.exit(1)
  }

  const repo = parseFlag(argv, "--repo") ?? process.env["EVAL_FIXTURE_REPO"] ?? ""

  const manifest =
    parseFlag(argv, "--manifest") ?? process.env["EVAL_FIXTURE_MANIFEST"] ?? "fixtures/latest.json"

  const manager = new FixtureManager({ repo, manifest })

  if (subcommand === "seed") {
    await manager.seed([])
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

import { access, rm } from "node:fs/promises"
import { pathToFileURL } from "node:url"

import { loadFixtureManifest } from "../fixture/manifest.js"
import { cleanupSeededFixtures } from "../fixture/cleanup.js"
import { applyFixtureAppAuthIfConfigured } from "../fixture/app-auth.js"
import { seedFixtureManifest } from "../fixture/seed.js"

type FixtureCommand = "seed" | "status" | "cleanup"

type ParsedFixtureArgs = {
  command: FixtureCommand
  repo: string
  outFile: string
  seedId: string
}

function parseFlagValue(args: string[], flag: string): string | null {
  const index = args.findIndex((arg) => arg === flag)
  if (index !== -1) {
    return args[index + 1] ?? null
  }

  const inline = args.find((arg) => arg.startsWith(`${flag}=`))
  if (inline) {
    return inline.slice(flag.length + 1)
  }

  return null
}

export function parseArgs(argv: string[]): ParsedFixtureArgs {
  const normalized = argv.filter((arg) => arg !== "--")
  const [commandRaw = "status"] = normalized
  if (commandRaw !== "seed" && commandRaw !== "status" && commandRaw !== "cleanup") {
    throw new Error(`Unsupported fixtures command: ${commandRaw}`)
  }

  const repo = parseFlagValue(normalized, "--repo") ?? process.env.BENCH_FIXTURE_REPO ?? "aryeko/ghx-bench-fixtures"
  const outFile = parseFlagValue(normalized, "--out") ?? process.env.BENCH_FIXTURE_MANIFEST ?? "fixtures/latest.json"
  const seedId = parseFlagValue(normalized, "--seed-id") ?? process.env.BENCH_FIXTURE_SEED_ID ?? "default"

  return {
    command: commandRaw,
    repo,
    outFile,
    seedId
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv)
  const restoreFixtureAuth =
    parsed.command === "seed" || parsed.command === "cleanup" ? await applyFixtureAppAuthIfConfigured() : () => undefined

  try {
    if (parsed.command === "seed") {
      const manifest = await seedFixtureManifest({
        repo: parsed.repo,
        outFile: parsed.outFile,
        seedId: parsed.seedId
      })
      console.log(`Seeded fixtures for ${manifest.repo.full_name} -> ${parsed.outFile}`)
      return
    }

    if (parsed.command === "status") {
      await access(parsed.outFile)
      const manifest = await loadFixtureManifest(parsed.outFile)
      console.log(
        `Fixture manifest OK: repo=${manifest.repo.full_name} version=${manifest.version} path=${parsed.outFile}`
      )
      return
    }

    const manifest = await loadFixtureManifest(parsed.outFile)
    const cleanup = await cleanupSeededFixtures(manifest)
    await rm(parsed.outFile, { force: true })
    console.log(`Closed ${cleanup.closedIssues} seeded issue(s) in ${manifest.repo.full_name}`)
    console.log(`Removed fixture manifest: ${parsed.outFile}`)
  } finally {
    restoreFixtureAuth()
  }
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exit(1)
  })
}

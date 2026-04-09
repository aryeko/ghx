/* global process */
import { execSync } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const checkMode = process.argv.includes("--check")

const scriptDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = dirname(scriptDir)
const repoRoot = join(packageRoot, "..", "..")

const pkg = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"))
const repoUrl = pkg.repository.url.replace(/^git\+/, "").replace(/\.git$/, "")

const pluginDescription = pkg.description
const packageKeywords = Array.isArray(pkg.keywords)
  ? pkg.keywords.filter((value) => typeof value === "string")
  : []
const pluginKeywords =
  packageKeywords.length > 0
    ? [...new Set(packageKeywords)]
    : ["github", "ai-agents", "cli", "automation"]

const authorObj = { name: typeof pkg.author === "string" ? pkg.author : (pkg.author?.name ?? "") }

const sharedFields = {
  name: "ghx",
  description: pluginDescription,
  version: pkg.version,
  author: authorObj,
  category: "development",
  repository: repoUrl,
  homepage: repoUrl,
  license: pkg.license,
  keywords: pluginKeywords,
}

/** Fields specific to Claude Code plugin (not derived from package.json). */
const claudeOnlyFields = {
  skills: ["skills"],
}

const claudePluginJson = { ...sharedFields, ...claudeOnlyFields }

const marketplaceJson = {
  name: "ghx-dev",
  description:
    "Marketplace for ghx — a GitHub execution router that gives AI agents deterministic, validated access to GitHub operations.",
  owner: authorObj,
  plugins: [
    {
      name: "ghx",
      description: pluginDescription,
      version: pkg.version,
      author: authorObj,
      source: { source: "npm", package: pkg.name },
      category: "development",
    },
  ],
}

/** Fields in the Cursor manifest that are NOT managed by this script. */
const cursorHandMaintainedKeys = new Set(["logo", "skills", "rules"])

/**
 * Read the existing Cursor manifest and merge synced fields into it,
 * preserving hand-maintained fields. If the file does not exist yet,
 * return only the synced fields (hand-maintained fields must be added
 * manually on first creation).
 */
async function buildCursorManifest() {
  const cursorPath = join(packageRoot, ".cursor-plugin", "plugin.json")
  let existing = {}
  try {
    existing = JSON.parse(await readFile(cursorPath, "utf8"))
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw new Error(`Failed to parse ${cursorPath}: ${error.message}`)
    }
    // File does not exist yet — start fresh with synced fields only.
  }

  const merged = { ...sharedFields }
  for (const key of cursorHandMaintainedKeys) {
    if (key in existing) {
      merged[key] = existing[key]
    }
  }
  return merged
}

const cursorPluginJson = await buildCursorManifest()

/** Full-JSON manifests: check and write compare the entire object. */
const fullManifests = [
  { path: join(packageRoot, ".claude-plugin", "plugin.json"), content: claudePluginJson },
  { path: join(repoRoot, ".claude-plugin", "marketplace.json"), content: marketplaceJson },
]

/** Partial-sync manifest: check compares only the synced field subset. */
const cursorManifest = {
  path: join(packageRoot, ".cursor-plugin", "plugin.json"),
  content: cursorPluginJson,
}

if (checkMode) {
  let drifted = false

  // Full-JSON comparison for Claude Code + marketplace manifests
  for (const { path, content } of fullManifests) {
    let actual
    try {
      actual = JSON.parse(await readFile(path, "utf8"))
    } catch {
      process.stderr.write(`Missing: ${path}\n`)
      drifted = true
      continue
    }
    if (JSON.stringify(actual) !== JSON.stringify(content)) {
      process.stderr.write(`Out of sync: ${path}\n`)
      drifted = true
    }
  }

  // Partial comparison for Cursor manifest (synced fields only)
  try {
    const actual = JSON.parse(await readFile(cursorManifest.path, "utf8"))
    for (const key of Object.keys(sharedFields)) {
      if (JSON.stringify(actual[key]) !== JSON.stringify(sharedFields[key])) {
        process.stderr.write(`Out of sync: ${cursorManifest.path} (field: ${key})\n`)
        drifted = true
        break
      }
    }
  } catch {
    process.stderr.write(`Missing: ${cursorManifest.path}\n`)
    drifted = true
  }

  if (drifted) {
    process.stderr.write("Run: pnpm --filter @ghx-dev/core run plugin:sync\n")
    process.exit(1)
  }
  process.stdout.write("Plugin manifests in sync.\n")
} else {
  const allManifests = [...fullManifests, cursorManifest]
  for (const { path, content } of allManifests) {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(content, null, 2) + "\n", "utf8")
  }
  execSync("biome check --write .claude-plugin/", { cwd: packageRoot, stdio: "inherit" })
  execSync("biome check --write .claude-plugin/", { cwd: repoRoot, stdio: "inherit" })
  execSync("biome check --write .cursor-plugin/", { cwd: packageRoot, stdio: "inherit" })
  process.stdout.write("Plugin manifests synced.\n")
}

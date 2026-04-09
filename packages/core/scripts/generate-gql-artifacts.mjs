/* global console, process */
import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, relative, resolve } from "node:path"

function fixGeneratedImportExtensions(packageRoot) {
  const opsDir = join(packageRoot, "src", "gql", "operations")
  fixGeneratedArtifactsInDir(opsDir, opsDir)
}

function fixGeneratedArtifactsInDir(dir, opsRoot) {
  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const entryPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      fixGeneratedArtifactsInDir(entryPath, opsRoot)
      continue
    }
    if (!entry.isFile() || !entry.name.endsWith(".generated.ts")) {
      continue
    }

    const content = readFileSync(entryPath, "utf8")
    const fixedImports = content.replace(/from '(\.\.?\/[^']+?)(?<!\.js)'/g, "from '$1.js'")
    // GitHub's GraphQL schema introspection varies by token capabilities for a few thread types.
    // Normalize these members to keep generated artifacts stable across local and CI tokens.
    let fixed = fixedImports
      .replace(/^\s+\| { __typename\?: ["']NotificationThread["'] }\r?$/gm, "")
      .replace(/^\s+\| { __typename\?: ["']RepositoryDependabotAlertsThread["'] }\r?$/gm, "")

    // Fix TypedDocumentString import path for files in subdirectories.
    // The `add` plugin injects `./typed-document-string.js` for every file,
    // but files in subdirectories (e.g. fragments/) need a deeper relative path.
    const depth = relative(opsRoot, dir).split("/").filter(Boolean).length
    if (depth > 0) {
      const correctPrefix = "../".repeat(depth)
      fixed = fixed.replace(
        /from ["']\.\/typed-document-string\.js["']/,
        `from "${correctPrefix}typed-document-string.js"`,
      )
    }

    if (fixed !== content) {
      writeFileSync(entryPath, fixed, "utf8")
    }
  }
}

async function main() {
  const packageRoot = resolve(process.cwd())

  const result = spawnSync("pnpm", ["exec", "graphql-codegen", "--config", "codegen.ts"], {
    cwd: packageRoot,
    stdio: "inherit",
  })

  if (result.status !== 0) {
    throw new Error(`GraphQL code generation failed with status ${result.status ?? "unknown"}`)
  }

  fixGeneratedImportExtensions(packageRoot)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

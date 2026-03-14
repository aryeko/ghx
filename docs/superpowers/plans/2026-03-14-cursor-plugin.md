# Cursor Plugin Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Cursor IDE plugin for ghx with rules, shared skill, and a sessionStart hook warning if ghx is not installed.

**Architecture:** New `.cursor-plugin/` directory in `packages/core/` alongside the existing `.claude-plugin/`. Shares `skills/using-ghx/SKILL.md` and a new `scripts/plugin/ensure-ghx.sh` with the Claude Code plugin. Sync script extended to keep metadata in sync across both plugin manifests.

**Tech Stack:** Shell (hook script), JSON (manifests), Markdown/MDC (rules), Node.js ESM (sync script)

**Spec:** `docs/superpowers/specs/2026-03-14-cursor-plugin-design.md`

---

## Chunk 1: Cursor Plugin Files

### Task 1: Create the shared ensure-ghx.sh hook script

**Files:**
- Create: `packages/core/scripts/plugin/ensure-ghx.sh`
- Delete: `packages/core/scripts/plugin/setup-env.sh`

- [ ] **Step 1: Create `ensure-ghx.sh`**

Create `packages/core/scripts/plugin/ensure-ghx.sh`.

The script does two things:
1. If `CLAUDE_ENV_FILE` is set (Claude Code context), inject the plugin's `bin/` directory into PATH so the bundled `ghx` binary is available. This preserves the functionality from the old `setup-env.sh`.
2. After PATH setup (or in non-Claude contexts like Cursor), check if `ghx` is available and warn if not.

```bash
#!/bin/bash
# Shared hook for Claude Code and Cursor plugins.
# 1. In Claude Code: add the plugin's bin/ to PATH via CLAUDE_ENV_FILE.
# 2. In all contexts: warn if ghx is not on PATH.

if [ -n "$CLAUDE_ENV_FILE" ] && [ -n "$CLAUDE_PLUGIN_ROOT" ]; then
  echo "export PATH=\"${CLAUDE_PLUGIN_ROOT}/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

if ! command -v ghx &>/dev/null && ! [ -x "${CLAUDE_PLUGIN_ROOT:-/nonexistent}/bin/ghx" ]; then
  echo "Warning: ghx CLI not found. Install with: npm install -g @ghx-dev/core"
fi

exit 0
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x packages/core/scripts/plugin/ensure-ghx.sh`

- [ ] **Step 3: Delete `setup-env.sh`**

Run: `rm packages/core/scripts/plugin/setup-env.sh`

- [ ] **Step 4: Update Claude Code hooks to use ensure-ghx.sh**

Replace the content of `packages/core/hooks/hooks.json` with:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/scripts/plugin/ensure-ghx.sh"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/core/scripts/plugin/ensure-ghx.sh packages/core/hooks/hooks.json
git rm packages/core/scripts/plugin/setup-env.sh
git commit -m "feat: replace setup-env.sh with shared ensure-ghx.sh hook"
```

---

### Task 2: Create the Cursor plugin manifest and hooks

**Files:**
- Create: `packages/core/.cursor-plugin/plugin.json`
- Create: `packages/core/.cursor-plugin/hooks/hooks.json`

- [ ] **Step 1: Create the Cursor plugin manifest**

Create `packages/core/.cursor-plugin/plugin.json`:

```json
{
  "name": "ghx",
  "description": "Route GitHub operations through deterministic adapters instead of fragile shell scraping. 70+ capabilities covering issues, PRs, repos, releases, and projects — each with validated input, normalized output, and automatic fallback routing.",
  "version": "0.4.2",
  "author": {
    "name": "Arye Kogan"
  },
  "category": "development",
  "repository": "https://github.com/aryeko/ghx",
  "homepage": "https://github.com/aryeko/ghx",
  "license": "MIT",
  "keywords": [
    "github",
    "github-api",
    "ai-agents",
    "agentic",
    "cli",
    "graphql",
    "automation",
    "typescript"
  ],
  "logo": "https://raw.githubusercontent.com/aryeko/ghx/main/assets/branding/logos/ghx-logo-icon.svg",
  "skills": "../skills/",
  "rules": "rules/"
}
```

Note: The synced fields (name, description, version, author, category, repository, homepage, license, keywords) will be managed by the sync script after Task 4. The initial values here match `packages/core/package.json`.

- [ ] **Step 2: Create the Cursor hooks config**

Create `packages/core/.cursor-plugin/hooks/hooks.json`:

```json
{
  "hooks": {
    "sessionStart": [
      {
        "command": "../scripts/plugin/ensure-ghx.sh"
      }
    ]
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/.cursor-plugin/plugin.json packages/core/.cursor-plugin/hooks/hooks.json
git commit -m "feat: add Cursor plugin manifest and hooks"
```

---

### Task 3: Create the .mdc rule files

**Files:**
- Create: `packages/core/.cursor-plugin/rules/prefer-ghx.mdc`
- Create: `packages/core/.cursor-plugin/rules/ghx-batching.mdc`
- Create: `packages/core/.cursor-plugin/rules/ghx-capabilities.mdc`

- [ ] **Step 1: Create `prefer-ghx.mdc`**

Create `packages/core/.cursor-plugin/rules/prefer-ghx.mdc`:

```markdown
---
description: Prefer ghx CLI over raw gh, gh api, or curl for GitHub operations
alwaysApply: true
---

When performing any GitHub operation (PRs, issues, reviews, CI checks, releases, labels, comments), use `ghx run` instead of `gh`, `gh api`, or `curl`. ghx provides validated input, structured JSON output, and automatic fallback routing.

Example:
```bash
# Instead of: gh pr view 123 --json title,state
ghx run --task pr.view --input '{"owner":"org","name":"repo","number":123}'
```
```

- [ ] **Step 2: Create `ghx-batching.mdc`**

Create `packages/core/.cursor-plugin/rules/ghx-batching.mdc`:

```markdown
---
description: Use ghx chain to batch multiple GitHub operations into a single API call
alwaysApply: true
---

When performing 2+ GitHub operations, use `ghx chain` with a JSON array of tasks instead of sequential `ghx run` calls. This batches operations into fewer API round-trips.

Example:
```bash
ghx chain --input '[
  {"task":"pr.view","input":{"owner":"org","name":"repo","number":123}},
  {"task":"pr.reviews.list","input":{"owner":"org","name":"repo","number":123}}
]'
```
```

- [ ] **Step 3: Create `ghx-capabilities.mdc`**

Create `packages/core/.cursor-plugin/rules/ghx-capabilities.mdc`:

```markdown
---
description: Check ghx capabilities before attempting raw GitHub API calls
alwaysApply: true
---

Before writing custom `gh api` or curl commands, run `ghx capabilities list` or `ghx capabilities explain <id>` to check if ghx already supports the operation. ghx covers 70+ capabilities across issues, PRs, repos, releases, workflows, and projects.

Example:
```bash
ghx capabilities list --domain pr
ghx capabilities explain pr.merge
```
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/.cursor-plugin/rules/
git commit -m "feat: add Cursor plugin .mdc rules"
```

---

## Chunk 2: Sync Script and Package Config

### Task 4: Extend the sync script for Cursor manifest

**Files:**
- Modify: `packages/core/scripts/sync-plugin-manifests.mjs`

The sync script needs to handle the Cursor manifest differently from the Claude Code manifest: it syncs only the shared metadata fields and preserves hand-maintained fields (`logo`, `skills`, `rules`).

- [ ] **Step 1: Add Cursor manifest support to the sync script**

Replace the full content of `packages/core/scripts/sync-plugin-manifests.mjs` with:

```javascript
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

const claudePluginJson = { ...sharedFields }

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
  } catch {
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
```

- [ ] **Step 2: Run the sync script to verify it works**

Run: `pnpm --filter @ghx-dev/core run plugin:sync`
Expected: "Plugin manifests synced." and all three manifests written correctly.

- [ ] **Step 3: Run check mode to verify it passes**

Run: `pnpm --filter @ghx-dev/core run plugin:sync:check`
Expected: "Plugin manifests in sync."

Note: If the npm script `plugin:sync:check` does not exist, run:
`node packages/core/scripts/sync-plugin-manifests.mjs --check`

- [ ] **Step 4: Commit**

```bash
git add packages/core/scripts/sync-plugin-manifests.mjs
git commit -m "feat: extend sync script for Cursor plugin manifest"
```

---

### Task 5: Add .cursor-plugin to package.json files array

**Files:**
- Modify: `packages/core/package.json`

- [ ] **Step 1: Add `.cursor-plugin` to the `files` array**

In `packages/core/package.json`, find the `"files"` array and add `".cursor-plugin"`:

```json
"files": [
  "bin",
  "dist",
  "hooks",
  "scripts/plugin",
  ".claude-plugin",
  ".cursor-plugin",
  "skills",
  "LICENSE",
  "README.md"
],
```

- [ ] **Step 2: Commit**

```bash
git add packages/core/package.json
git commit -m "chore: include .cursor-plugin in npm package files"
```

---

### Task 6: Add changeset

**Files:**
- Create: `.changeset/cursor-plugin.md`

- [ ] **Step 1: Create the changeset file**

Create `.changeset/cursor-plugin.md`:

```markdown
---
"@ghx-dev/core": patch
---

Add Cursor IDE plugin with rules, shared skill reference, and sessionStart hook.
```

- [ ] **Step 2: Commit**

```bash
git add .changeset/cursor-plugin.md
git commit -m "chore: add changeset for Cursor plugin"
```

---

## Chunk 3: Validation

### Task 7: Run CI and verify

- [ ] **Step 1: Run the full CI suite**

Run: `pnpm run ci --outputStyle=static`
Expected: All checks pass (build, format, lint, test, typecheck).

- [ ] **Step 2: Run the sync check**

Run: `node packages/core/scripts/sync-plugin-manifests.mjs --check`
Expected: "Plugin manifests in sync."

- [ ] **Step 3: Verify file structure**

Run: `find packages/core/.cursor-plugin -type f | sort`
Expected output:
```
packages/core/.cursor-plugin/hooks/hooks.json
packages/core/.cursor-plugin/plugin.json
packages/core/.cursor-plugin/rules/ghx-batching.mdc
packages/core/.cursor-plugin/rules/ghx-capabilities.mdc
packages/core/.cursor-plugin/rules/prefer-ghx.mdc
```

- [ ] **Step 4: Verify ensure-ghx.sh is executable**

Run: `test -x packages/core/scripts/plugin/ensure-ghx.sh && echo "OK" || echo "FAIL"`
Expected: `OK`

- [ ] **Step 5: Verify setup-env.sh is deleted**

Run: `test -f packages/core/scripts/plugin/setup-env.sh && echo "EXISTS" || echo "DELETED"`
Expected: `DELETED`

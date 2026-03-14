# Cursor Plugin for ghx

## Overview

Add a Cursor IDE plugin that packages the existing SKILL.md, 3 always-apply `.mdc` rules, and a sessionStart hook warning if ghx is not installed. Also add the same warning hook to the existing Claude Code plugin. Distributed via the Cursor marketplace.

## Goals

- Cursor agents automatically prefer `ghx` over raw `gh`/`gh api`/`curl`
- Share the existing `skills/using-ghx/SKILL.md` (no duplication)
- Keep Cursor manifest metadata in sync with Claude Code manifest via the existing sync script
- Lightweight: rules + skill + sessionStart warning hook, no MCP server
- Both Claude Code and Cursor plugins warn users if ghx is not on PATH

## File Structure

```
packages/core/
├── .claude-plugin/plugin.json           (existing, unchanged)
├── .cursor-plugin/
│   ├── plugin.json                      (new - Cursor manifest)
│   ├── rules/
│   │   ├── prefer-ghx.mdc
│   │   ├── ghx-batching.mdc
│   │   └── ghx-capabilities.mdc
│   └── hooks/
│       └── hooks.json                   (references shared ensure-ghx.sh)
├── hooks/hooks.json                     (existing, add ensure-ghx.sh hook)
├── scripts/plugin/
│   └── ensure-ghx.sh                    (new, replaces setup-env.sh, shared by both plugins)
├── skills/using-ghx/SKILL.md            (existing, shared by both plugins)
```

Shared assets (`skills/`, `scripts/plugin/ensure-ghx.sh`) live at the package root. Both plugin manifests reference them via relative `..` paths, the same pattern used for skills.

## Cursor Plugin Manifest

`packages/core/.cursor-plugin/plugin.json`:

```json
{
  "name": "ghx",
  "description": "<synced from package.json>",
  "version": "<synced from package.json>",
  "author": { "name": "<synced from package.json>" },
  "category": "development",
  "homepage": "<synced from package.json>",
  "repository": "<synced from package.json>",
  "license": "<synced from package.json>",
  "keywords": ["<synced from package.json>"],
  "logo": "https://raw.githubusercontent.com/aryeko/ghx/main/assets/branding/logos/ghx-logo-icon.svg",
  "skills": "../skills/",
  "rules": "rules/"
}
```

**Synced fields:** name, description, version, author, category, homepage, repository, license, keywords -- managed by `sync-plugin-manifests.mjs`.

**Hand-maintained fields:** `logo` (raw GitHub URL to existing SVG icon), `skills` (relative path to shared skill directory), and `rules` (explicit path to rules directory). The sync script does not touch these.

### Path notes

The `skills` field uses `../skills/` which traverses up one directory. The Cursor submission checklist says to avoid `..` in paths. Two approaches:

1. **Try submitting as-is** -- the checklist may be advisory rather than enforced. If rejected, fall back to option 2.
2. **Build-time copy** -- add a script that copies `skills/using-ghx/` into `.cursor-plugin/skills/using-ghx/` before publishing, and change the path to `"skills": "skills/"`. Add `.cursor-plugin/skills/` to `.gitignore`.

Start with option 1. If submission rejects the `..` path, implement option 2.

## Rule Files

All three rules use `alwaysApply: true` so they are always present in the agent's context.

### `prefer-ghx.mdc`

```markdown
---
description: Prefer ghx CLI over raw gh, gh api, or curl for GitHub operations
alwaysApply: true
---

When performing any GitHub operation (PRs, issues, reviews, CI checks, releases, labels, comments), use `ghx run` instead of `gh`, `gh api`, or `curl`. ghx provides validated input, structured JSON output, and automatic fallback routing.

Example:
\`\`\`bash
# Instead of: gh pr view 123 --json title,state
ghx run --task pr.view --input '{"owner":"org","name":"repo","number":123}'
\`\`\`
```

### `ghx-batching.mdc`

```markdown
---
description: Use ghx chain to batch multiple GitHub operations into a single API call
alwaysApply: true
---

When performing 2+ GitHub operations, use `ghx chain` with a JSON array of tasks instead of sequential `ghx run` calls. This batches operations into fewer API round-trips.

Example:
\`\`\`bash
ghx chain --input '[
  {"task":"pr.view","input":{"owner":"org","name":"repo","number":123}},
  {"task":"pr.reviews.list","input":{"owner":"org","name":"repo","number":123}}
]'
\`\`\`
```

### `ghx-capabilities.mdc`

```markdown
---
description: Check ghx capabilities before attempting raw GitHub API calls
alwaysApply: true
---

Before writing custom `gh api` or curl commands, run `ghx capabilities list` or `ghx capabilities explain <id>` to check if ghx already supports the operation. ghx covers 70+ capabilities across issues, PRs, repos, releases, workflows, and projects.

Example:
\`\`\`bash
ghx capabilities list --domain pr
ghx capabilities explain pr.merge
\`\`\`
```

## SessionStart Hooks

A single shared script at `packages/core/scripts/plugin/ensure-ghx.sh` is referenced by both plugins, the same pattern used for the shared skill.

### Shared Script

`packages/core/scripts/plugin/ensure-ghx.sh`:

```bash
#!/bin/bash
if ! command -v ghx &>/dev/null; then
  echo "Warning: ghx CLI not found. Install with: npm install -g @ghx-dev/core"
fi
exit 0
```

### Cursor Plugin Hook

`packages/core/.cursor-plugin/hooks/hooks.json`:

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

### Claude Code Plugin Hook (Existing, Modified)

Replace the existing `setup-env.sh` hook in `packages/core/hooks/hooks.json` with `ensure-ghx.sh`:

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

Delete `packages/core/scripts/plugin/setup-env.sh` — it is no longer needed.

## Sync Script Changes

`packages/core/scripts/sync-plugin-manifests.mjs` is extended:

1. Add a third manifest entry for `.cursor-plugin/plugin.json`
2. The Cursor entry includes only the synced fields: name, description, version, author, category, repository, homepage, license, keywords
3. Before writing, the script reads the existing `.cursor-plugin/plugin.json` and merges synced fields into it, preserving hand-maintained fields (`logo`, `skills`, `rules`)
4. `--check` mode compares only the synced field subset (not the full JSON) for the Cursor manifest
5. Biome formatting runs on `.cursor-plugin/` after write

## npm Package Changes

Add `".cursor-plugin"` to the `files` array in `packages/core/package.json` so the Cursor plugin directory is included in the published npm package.

## Submission

1. Implement the plugin following this spec
2. Run `pnpm run ci` to verify everything passes
3. Push to public repo (github.com/aryeko/ghx)
4. Submit via cursor.com/marketplace/publish

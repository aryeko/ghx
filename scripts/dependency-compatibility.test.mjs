import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import execCommands from "nx/src/command-line/release/utils/exec-command.js"
import { RepoGitTags } from "nx/src/command-line/release/utils/repository-git-tags.js"
import { glob } from "nx/src/devkit-exports.js"
import { FsTree } from "nx/src/generators/tree.js"
import { expandWildcardTargetConfiguration } from "nx/src/tasks-runner/utils.js"
import { findMatchingProjects } from "nx/src/utils/find-matching-projects.js"

test("Nx generator globs include created files and exclude deleted files", (t) => {
  const root = mkdtempSync(join(tmpdir(), "ghx-nx-glob-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, "src"))
  writeFileSync(join(root, "src/keep.ts"), "")
  writeFileSync(join(root, "src/delete.ts"), "")
  const tree = new FsTree(root, false)
  tree.delete("src/delete.ts")
  tree.write("src/new/module.ts", "")
  tree.write("src/new/settings.json", "{}")
  tree.write("src/new/ignore.md", "")

  assert.deepEqual(glob(tree, ["src/**/*.ts", "src/**/*.json"]).sort(), [
    "src/keep.ts",
    "src/new/module.ts",
    "src/new/settings.json",
  ])
  assert.throws(() => glob(tree, []), /Invalid glob pattern/)
})

test("Nx project patterns include hidden directories and support exclusions", () => {
  const projects = {
    workspace: { data: { root: "packages" } },
    core: { data: { root: "packages/core" } },
    fixtures: { data: { root: "packages/.fixtures" } },
    internal: { data: { root: "packages/internal" } },
    web: { data: { root: "apps/web" } },
  }

  assert.deepEqual(findMatchingProjects(["directory:packages/*", "!name:inter*"], projects), [
    "core",
    "fixtures",
  ])
  assert.deepEqual(
    findMatchingProjects(["directory:{packages/**,apps/**}", "!name:inter*"], projects),
    ["workspace", "core", "fixtures", "web"],
  )
  assert.deepEqual(findMatchingProjects(["directory:!packages/**"], projects), ["web"])
  assert.throws(
    () => findMatchingProjects(["directory:#comment"], projects),
    /Invalid glob pattern/,
  )
})

test("Nx wildcard task dependencies expand only matching targets", () => {
  const dependency = { target: "test:*", dependencies: true }

  assert.deepEqual(
    expandWildcardTargetConfiguration(dependency, ["test:unit", "test:e2e", "test", "build"]),
    [
      { target: "test:unit", dependencies: true },
      { target: "test:e2e", dependencies: true },
    ],
  )
})

test("Nx release branch patterns select tags from all branches when matched", async (t) => {
  t.mock.method(execCommands, "execCommand", async (_command, args) => {
    if (args[0] === "rev-parse") return "release/stable\n"
    return args.includes("--merged") ? "v1.0.0\n" : "v2.0.0\nv1.0.0\n"
  })
  const tags = RepoGitTags.create()

  assert.deepEqual(await tags.resolveTags(["release/stable/**"]), ["v2.0.0", "v1.0.0"])
  assert.deepEqual(await tags.resolveTags(["feature/*"]), ["v1.0.0"])
})

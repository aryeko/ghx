import { randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  applyRepoContextDefaultsToInput,
  applyRepoContextDefaultsToSteps,
  resolveRepoContext,
} from "@core/cli/repo-context.js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

function makeTempDir(name: string): string {
  return join(tmpdir(), `ghx-${name}-${randomUUID()}`)
}

async function writeGitRemote(root: string, remoteUrl: string): Promise<void> {
  await mkdir(join(root, ".git"), { recursive: true })
  await writeFile(
    join(root, ".git", "config"),
    `[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\turl = ${remoteUrl}\n`,
    "utf8",
  )
}

describe("repo context cache", () => {
  let tempRoot: string
  let cacheRoot: string

  beforeEach(async () => {
    tempRoot = makeTempDir("repo-context")
    cacheRoot = makeTempDir("repo-context-cache")
    await mkdir(tempRoot, { recursive: true })
    vi.stubEnv("XDG_CACHE_HOME", cacheRoot)
    vi.stubEnv("GITHUB_REPOSITORY", undefined)
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(tempRoot, { recursive: true, force: true })
    await rm(cacheRoot, { recursive: true, force: true })
  })

  it("resolves owner and name from origin remote and reuses the cached context", async () => {
    await writeGitRemote(tempRoot, "git@github.com:acme/widgets.git")

    const first = await resolveRepoContext({ cwd: tempRoot })
    expect(first).toMatchObject({
      owner: "acme",
      name: "widgets",
      remoteUrl: "git@github.com:acme/widgets.git",
      source: "git",
    })

    await rm(join(tempRoot, ".git", "config"), { force: true })

    const second = await resolveRepoContext({ cwd: tempRoot })
    expect(second).toMatchObject({
      owner: "acme",
      name: "widgets",
      source: "cache",
    })
  })

  it("uses GITHUB_REPOSITORY when no git remote context is available", async () => {
    vi.stubEnv("GITHUB_REPOSITORY", "octo/demo")

    await expect(resolveRepoContext({ cwd: tempRoot })).resolves.toMatchObject({
      owner: "octo",
      name: "demo",
      source: "env",
    })
  })

  it("resolves origin remote from a git worktree commondir", async () => {
    const gitDir = join(tempRoot, ".git-worktree", "worktrees", "feature")
    const commonDir = join(tempRoot, ".git-common")
    await mkdir(gitDir, { recursive: true })
    await mkdir(commonDir, { recursive: true })
    await writeFile(join(tempRoot, ".git"), `gitdir: ${gitDir}\n`, "utf8")
    await writeFile(join(gitDir, "commondir"), `${commonDir}\n`, "utf8")
    await writeFile(
      join(commonDir, "config"),
      `[remote "origin"]\n\turl = git@github.com:acme/worktree-repo.git\n`,
      "utf8",
    )

    await expect(resolveRepoContext({ cwd: tempRoot })).resolves.toMatchObject({
      owner: "acme",
      name: "worktree-repo",
      source: "git",
    })
  })

  it("fills missing owner and name for repo-scoped capability input", async () => {
    await writeGitRemote(tempRoot, "https://github.com/acme/widgets.git")

    await expect(
      applyRepoContextDefaultsToInput("pr.view", { prNumber: 7 }, { cwd: tempRoot }),
    ).resolves.toEqual({ owner: "acme", name: "widgets", prNumber: 7 })
  })

  it("does not overwrite explicit owner or name values", async () => {
    await writeGitRemote(tempRoot, "https://github.com/acme/widgets.git")

    await expect(
      applyRepoContextDefaultsToInput(
        "pr.view",
        { owner: "other", name: "repo", prNumber: 7 },
        { cwd: tempRoot },
      ),
    ).resolves.toEqual({ owner: "other", name: "repo", prNumber: 7 })
  })

  it("does not fill project owner fields that are not paired with a repo name", async () => {
    await writeGitRemote(tempRoot, "https://github.com/acme/widgets.git")

    await expect(
      applyRepoContextDefaultsToInput(
        "project_v2.items.list",
        { projectNumber: 12 },
        { cwd: tempRoot },
      ),
    ).resolves.toEqual({ projectNumber: 12 })
  })

  it("fills each repo-scoped chain step from one resolved context", async () => {
    await writeGitRemote(tempRoot, "https://github.com/acme/widgets.git")

    await expect(
      applyRepoContextDefaultsToSteps(
        [
          { task: "pr.view", input: { prNumber: 1 } },
          { task: "issue.view", input: { issueNumber: 2, owner: "explicit" } },
          { task: "project_v2.items.list", input: { projectNumber: 3 } },
        ],
        { cwd: tempRoot },
      ),
    ).resolves.toEqual([
      { task: "pr.view", input: { owner: "acme", name: "widgets", prNumber: 1 } },
      { task: "issue.view", input: { owner: "explicit", name: "widgets", issueNumber: 2 } },
      { task: "project_v2.items.list", input: { projectNumber: 3 } },
    ])
  })

  it("writes repo context under the ghx cache root", async () => {
    await writeGitRemote(tempRoot, "https://github.com/acme/widgets.git")

    await resolveRepoContext({ cwd: tempRoot })

    const cacheDir = join(cacheRoot, "ghx", "repos")
    const entries = await import("node:fs/promises").then((fs) => fs.readdir(cacheDir))
    expect(entries).toHaveLength(1)
    const raw = await readFile(join(cacheDir, entries[0] ?? ""), "utf8")
    expect(JSON.parse(raw)).toMatchObject({
      version: 1,
      owner: "acme",
      name: "widgets",
      remoteUrl: "https://github.com/acme/widgets.git",
    })
  })
})

import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
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

function cachePathFor(key: string, cacheRoot: string): string {
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 32)
  return join(cacheRoot, "ghx", "repos", `${hash}.json`)
}

async function writeCacheEntry(key: string, value: unknown, cacheRoot: string): Promise<void> {
  const path = cachePathFor(key, cacheRoot)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, typeof value === "string" ? value : JSON.stringify(value), "utf8")
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

  it("returns null for malformed GITHUB_REPOSITORY when no git context is available", async () => {
    vi.stubEnv("GITHUB_REPOSITORY", "not/a/repo/path")

    await expect(resolveRepoContext({ cwd: tempRoot })).resolves.toBeNull()
  })

  it("returns null when git metadata exists without an origin remote", async () => {
    await mkdir(join(tempRoot, ".git"), { recursive: true })
    await writeFile(join(tempRoot, ".git", "config"), '[remote "upstream"]\n\turl = x\n', "utf8")

    await expect(resolveRepoContext({ cwd: tempRoot })).resolves.toBeNull()
  })

  it("returns null when origin remote cannot be parsed as owner/name", async () => {
    await writeGitRemote(tempRoot, "file:///tmp/local-repo")

    await expect(resolveRepoContext({ cwd: tempRoot })).resolves.toBeNull()
  })

  it("returns null when a .git file has no gitdir", async () => {
    await writeFile(join(tempRoot, ".git"), "not a gitdir file\n", "utf8")

    await expect(resolveRepoContext({ cwd: tempRoot })).resolves.toBeNull()
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

  it("resolves origin remote from a relative gitdir and relative commondir", async () => {
    const gitDir = join(tempRoot, "gitdir", "worktrees", "feature")
    const commonDir = join(tempRoot, "gitdir")
    await mkdir(gitDir, { recursive: true })
    await writeFile(join(tempRoot, ".git"), "gitdir: gitdir/worktrees/feature\n", "utf8")
    await writeFile(join(gitDir, "commondir"), "../..\n", "utf8")
    await writeFile(
      join(commonDir, "config"),
      `[remote "origin"]\n\turl = ssh://git@github.com/acme/relative-worktree.git\n`,
      "utf8",
    )

    await expect(resolveRepoContext({ cwd: tempRoot })).resolves.toMatchObject({
      owner: "acme",
      name: "relative-worktree",
      source: "git",
    })
  })

  it("ignores invalid cached JSON and refreshes from git", async () => {
    await writeGitRemote(tempRoot, "https://github.com/acme/widgets.git")
    await writeCacheEntry(tempRoot, "{not-json", cacheRoot)

    await expect(resolveRepoContext({ cwd: tempRoot })).resolves.toMatchObject({
      owner: "acme",
      name: "widgets",
      source: "git",
    })
  })

  it("ignores stale cache entries and refreshes from git", async () => {
    await writeGitRemote(tempRoot, "https://github.com/acme/widgets.git")
    await writeCacheEntry(
      tempRoot,
      {
        version: 1,
        owner: "stale",
        name: "repo",
        updatedAt: "2000-01-01T00:00:00.000Z",
      },
      cacheRoot,
    )

    await expect(resolveRepoContext({ cwd: tempRoot })).resolves.toMatchObject({
      owner: "acme",
      name: "widgets",
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

  it("leaves repo-scoped input unchanged when repo context is unavailable", async () => {
    await expect(
      applyRepoContextDefaultsToInput("pr.view", { prNumber: 7 }, { cwd: tempRoot }),
    ).resolves.toEqual({ prNumber: 7 })
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

  it("leaves repo-scoped chain steps unchanged when repo context is unavailable", async () => {
    await expect(
      applyRepoContextDefaultsToSteps([{ task: "pr.view", input: { prNumber: 1 } }], {
        cwd: tempRoot,
      }),
    ).resolves.toEqual([{ task: "pr.view", input: { prNumber: 1 } }])
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

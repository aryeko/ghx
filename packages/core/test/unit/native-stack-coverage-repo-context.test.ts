import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  applyRepoContextDefaultsToInput,
  applyRepoContextDefaultsToSteps,
} from "@core/cli/repo-context.js"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

describe("native stack repository inference", () => {
  let cwd: string
  let env: NodeJS.ProcessEnv

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "ghx-stack-context-"))
    env = { XDG_CACHE_HOME: join(cwd, "cache"), GITHUB_REPOSITORY: "acme/widget" }
  })

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true })
  })

  it.each([
    { server: undefined, expected: { owner: "acme", name: "widget" } },
    { server: "https://github.com", expected: { owner: "acme", name: "widget" } },
    { server: "https://github.example.com", expected: {} },
    { server: "invalid", expected: {} },
  ])(
    "uses GITHUB_SERVER_URL when inferring the repository from the environment ($server)",
    async ({ server, expected }) => {
      const options = { cwd, env: { ...env, GITHUB_SERVER_URL: server } }

      await expect(applyRepoContextDefaultsToInput("pr.stack.list", {}, options)).resolves.toEqual(
        expected,
      )
    },
  )

  it("prefers a GitHub.com SSH origin over the server URL for chain steps", async () => {
    const gitDir = join(cwd, ".git")
    await mkdir(gitDir)
    await writeFile(
      join(gitDir, "config"),
      '[remote "origin"]\n\turl = git@ssh.github.com:acme/ssh-widget.git\n',
    )

    await expect(
      applyRepoContextDefaultsToSteps(
        [
          { task: "pr.stack.list", input: { prNumber: 9 } },
          { task: "pr.stack.view", input: { stackNumber: 42, name: "explicit" } },
        ],
        { cwd, env: { ...env, GITHUB_SERVER_URL: "https://github.example.com" } },
      ),
    ).resolves.toEqual([
      { task: "pr.stack.list", input: { owner: "acme", name: "ssh-widget", prNumber: 9 } },
      { task: "pr.stack.view", input: { owner: "acme", name: "explicit", stackNumber: 42 } },
    ])
  })
})

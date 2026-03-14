import * as childProcess from "node:child_process"
import { createIssueBranchSeeder } from "@eval/fixture/seeders/issue-branch-seeder.js"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
}))

const mockedExecFile = vi.mocked(childProcess.execFile)
const mockedSpawn = vi.mocked(childProcess.spawn)

function mockExecFileResults(
  results: readonly { readonly stdout: string; readonly stderr: string }[],
) {
  let callIndex = 0
  mockedExecFile.mockImplementation((...args: unknown[]) => {
    const callback = args[args.length - 1] as (
      err: Error | null,
      stdout: string,
      stderr: string,
    ) => void
    const result = results[callIndex++]
    if (!result) {
      callback(new Error("unexpected execFile call"), "", "")
    } else {
      callback(null, result.stdout, result.stderr)
    }
    return {} as ReturnType<typeof childProcess.execFile>
  })
}

function mockSpawnResults(results: readonly string[]) {
  let callIndex = 0
  mockedSpawn.mockImplementation((..._args: unknown[]) => {
    const result = results[callIndex++] ?? ""
    const stdin = {
      write: vi.fn(),
      end: vi.fn(),
    }
    const stdout = {
      on: vi.fn((event: string, cb: (chunk: Buffer) => void) => {
        if (event === "data") {
          cb(Buffer.from(result))
        }
      }),
    }
    const stderr = {
      on: vi.fn(),
    }
    const proc = {
      stdin,
      stdout,
      stderr,
      on: vi.fn((event: string, cb: (code: number) => void) => {
        if (event === "close") {
          // Call close handler on next tick to simulate async
          process.nextTick(() => cb(0))
        }
      }),
    }
    return proc as unknown as ReturnType<typeof childProcess.spawn>
  })
}

describe("createIssueBranchSeeder", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a seeder with type 'issue_with_branch'", () => {
    const seeder = createIssueBranchSeeder()
    expect(seeder.type).toBe("issue_with_branch")
  })

  it("creates an issue and a branch, returning composite metadata", async () => {
    const issueList = [{ number: 30, title: "[@ghx-dev/eval] issue_with_branch" }]

    // execFile calls: get default branch (--jq returns plain string), get HEAD sha (--jq returns plain string), issue create, issue list
    mockExecFileResults([
      { stdout: "main", stderr: "" },
      { stdout: "abc123", stderr: "" },
      { stdout: "", stderr: "" },
      { stdout: JSON.stringify(issueList), stderr: "" },
    ])

    // spawn calls: create tree, create commit, create ref
    mockSpawnResults([
      JSON.stringify({ sha: "tree456" }),
      JSON.stringify({ sha: "commit789" }),
      JSON.stringify({ ref: "refs/heads/eval-fix-issue_with_branch" }),
    ])

    const seeder = createIssueBranchSeeder()
    const result = await seeder.seed({
      repo: "acme/sandbox",
      name: "issue_with_branch",
      labels: ["@ghx-dev/eval"],
    })

    expect(result.type).toBe("issue")
    expect(result.number).toBe(30)
    expect(result.repo).toBe("acme/sandbox")
    expect(result.labels).toEqual(["@ghx-dev/eval"])
    expect(result.metadata).toMatchObject({
      baseBranch: "main",
      branchSha: "commit789",
    })
    // headBranch has a Date.now() suffix so just check prefix
    expect((result.metadata as Record<string, string>).headBranch).toMatch(
      /^eval-fix-issue_with_branch/,
    )
  })

  it("calls gh api with correct args for branch creation", async () => {
    const issueList = [{ number: 5, title: "[@ghx-dev/eval] branch_test" }]

    mockExecFileResults([
      { stdout: "main", stderr: "" },
      { stdout: "sha999", stderr: "" },
      { stdout: "", stderr: "" },
      { stdout: JSON.stringify(issueList), stderr: "" },
    ])

    mockSpawnResults([
      JSON.stringify({ sha: "treeShaBranch" }),
      JSON.stringify({ sha: "commitShaBranch" }),
      JSON.stringify({ ref: "refs/heads/eval-fix-branch_test" }),
    ])

    const seeder = createIssueBranchSeeder()
    await seeder.seed({
      repo: "acme/sandbox",
      name: "branch_test",
      labels: ["@ghx-dev/eval"],
    })

    const execFileCalls = mockedExecFile.mock.calls
    expect(execFileCalls).toHaveLength(4)

    // First execFile call: get default branch
    const repoCall = execFileCalls[0] as unknown[]
    expect(repoCall[0]).toBe("gh")
    expect(repoCall[1]).toEqual(
      expect.arrayContaining(["api", "repos/acme/sandbox", "--jq", ".default_branch"]),
    )

    // Second execFile call: get HEAD sha
    const refCall = execFileCalls[1] as unknown[]
    expect(refCall[0]).toBe("gh")
    expect(refCall[1]).toEqual(
      expect.arrayContaining(["api", "repos/acme/sandbox/git/ref/heads/main"]),
    )

    // spawn calls for tree, commit, ref creation
    const spawnCalls = mockedSpawn.mock.calls
    expect(spawnCalls).toHaveLength(3)

    const treeCall = spawnCalls[0] as unknown[]
    expect(treeCall[0]).toBe("gh")
    expect(treeCall[1]).toEqual(
      expect.arrayContaining(["api", "repos/acme/sandbox/git/trees", "--method", "POST"]),
    )

    const commitCall = spawnCalls[1] as unknown[]
    expect(commitCall[0]).toBe("gh")
    expect(commitCall[1]).toEqual(
      expect.arrayContaining(["api", "repos/acme/sandbox/git/commits", "--method", "POST"]),
    )

    const createRefCall = spawnCalls[2] as unknown[]
    expect(createRefCall[0]).toBe("gh")
    expect(createRefCall[1]).toEqual(
      expect.arrayContaining(["api", "repos/acme/sandbox/git/refs", "--method", "POST"]),
    )
  })

  it("throws when issue cannot be found after creation", async () => {
    mockExecFileResults([
      { stdout: "main", stderr: "" },
      { stdout: "sha000", stderr: "" },
      { stdout: "", stderr: "" },
      { stdout: "[]", stderr: "" },
    ])

    mockSpawnResults([
      JSON.stringify({ sha: "treeX" }),
      JSON.stringify({ sha: "commitX" }),
      JSON.stringify({ ref: "refs/heads/eval-fix-ghost_branch" }),
    ])

    const seeder = createIssueBranchSeeder()

    await expect(
      seeder.seed({
        repo: "acme/sandbox",
        name: "ghost_branch",
        labels: ["@ghx-dev/eval"],
      }),
    ).rejects.toThrow(/could not find.*ghost_branch/i)
  })
})

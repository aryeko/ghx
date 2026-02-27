import { execFile } from "node:child_process"
import { createPrSeeder } from "@eval/fixture/seeders/pr-seeder.js"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}))

const mockedExecFile = vi.mocked(execFile)

const DEFAULT_BRANCH = "main"
const HEAD_SHA = "abc123def456"
const TREE_SHA = "tree789"
const COMMIT_SHA = "commit456"
const PR_NUMBER = 42
const REPO = "test-owner/test-repo"
const FIXTURE_NAME = "pr_with_threads"
const LABELS = ["eval-fixture", "bench"]

function mockGhCall(stdout: string) {
  mockedExecFile.mockImplementationOnce((_cmd: unknown, _args: unknown, callback: unknown) => {
    ;(callback as (err: null, stdout: string, stderr: string) => void)(null, stdout, "")
    return undefined as never
  })
}

function setupHappyPath() {
  // 1. Get default branch via graphql
  mockGhCall(
    JSON.stringify({
      data: {
        repository: { defaultBranchRef: { name: DEFAULT_BRANCH } },
      },
    }),
  )

  // 2. Get HEAD sha of default branch
  mockGhCall(JSON.stringify({ object: { sha: HEAD_SHA } }))

  // 3. Create tree
  mockGhCall(JSON.stringify({ sha: TREE_SHA }))

  // 4. Create commit
  mockGhCall(JSON.stringify({ sha: COMMIT_SHA }))

  // 5. Create branch ref
  mockGhCall(JSON.stringify({ ref: "refs/heads/bench-fixture/pr_with_threads-1234" }))

  // 6. Open PR via gh pr create
  mockGhCall("")

  // 7. Get PR number + headRefOid via gh pr view
  mockGhCall(JSON.stringify({ number: PR_NUMBER, headRefOid: COMMIT_SHA }))
}

describe("createPrSeeder", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a seeder with type 'pr'", () => {
    const seeder = createPrSeeder()
    expect(seeder.type).toBe("pr")
  })

  it("seed() returns a FixtureResource with correct fields", async () => {
    setupHappyPath()

    const seeder = createPrSeeder()
    const result = await seeder.seed({
      repo: REPO,
      name: FIXTURE_NAME,
      labels: LABELS,
    })

    expect(result.type).toBe("pr")
    expect(result.number).toBe(PR_NUMBER)
    expect(result.repo).toBe(REPO)
    expect(result.branch).toMatch(/^bench-fixture\/pr_with_threads-\d+$/)
    expect(result.labels).toEqual(LABELS)
    expect(result.metadata).toHaveProperty("originalSha", HEAD_SHA)
  })

  it("calls gh with expected arguments in sequence", async () => {
    setupHappyPath()

    const seeder = createPrSeeder()
    await seeder.seed({
      repo: REPO,
      name: FIXTURE_NAME,
      labels: LABELS,
    })

    expect(mockedExecFile).toHaveBeenCalledTimes(7)

    // 1. Get default branch
    const firstCallArgs = mockedExecFile.mock.calls[0]
    expect(firstCallArgs[0]).toBe("gh")
    expect(firstCallArgs[1]).toEqual(expect.arrayContaining(["api", "graphql"]))

    // 2. Get HEAD sha
    const secondCallArgs = mockedExecFile.mock.calls[1]
    expect(secondCallArgs[0]).toBe("gh")
    expect(secondCallArgs[1]).toEqual(
      expect.arrayContaining(["api", `repos/${REPO}/git/refs/heads/${DEFAULT_BRANCH}`]),
    )

    // 3. Create tree
    const thirdCallArgs = mockedExecFile.mock.calls[2]
    expect(thirdCallArgs[0]).toBe("gh")
    expect(thirdCallArgs[1]).toEqual(expect.arrayContaining(["api", `repos/${REPO}/git/trees`]))

    // 4. Create commit
    const fourthCallArgs = mockedExecFile.mock.calls[3]
    expect(fourthCallArgs[0]).toBe("gh")
    expect(fourthCallArgs[1]).toEqual(expect.arrayContaining(["api", `repos/${REPO}/git/commits`]))

    // 5. Create branch ref
    const fifthCallArgs = mockedExecFile.mock.calls[4]
    expect(fifthCallArgs[0]).toBe("gh")
    expect(fifthCallArgs[1]).toEqual(expect.arrayContaining(["api", `repos/${REPO}/git/refs`]))

    // 6. Open PR
    const sixthCallArgs = mockedExecFile.mock.calls[5]
    expect(sixthCallArgs[0]).toBe("gh")
    expect(sixthCallArgs[1]).toEqual(expect.arrayContaining(["pr", "create"]))

    // 7. Get PR details
    const seventhCallArgs = mockedExecFile.mock.calls[6]
    expect(seventhCallArgs[0]).toBe("gh")
    expect(seventhCallArgs[1]).toEqual(expect.arrayContaining(["pr", "view"]))
  })
})

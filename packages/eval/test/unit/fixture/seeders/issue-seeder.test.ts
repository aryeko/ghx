import * as childProcess from "node:child_process"
import { createIssueSeeder } from "@eval/fixture/seeders/issue-seeder.js"
import { afterEach, describe, expect, it, vi } from "vitest"
import { mockExecFileResults } from "./helpers.js"

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}))

const mockedExecFile = vi.mocked(childProcess.execFile)

describe("createIssueSeeder", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a seeder with type 'issue'", () => {
    const seeder = createIssueSeeder()
    expect(seeder.type).toBe("issue")
  })

  it("creates an issue and returns a FixtureResource", async () => {
    mockExecFileResults(mockedExecFile, [
      { stdout: "https://github.com/acme/sandbox/issues/42\n", stderr: "" },
    ])

    const seeder = createIssueSeeder()
    const result = await seeder.seed({
      repo: "acme/sandbox",
      name: "open_issue",
      labels: ["@ghx-dev/eval", "eval"],
    })

    expect(result).toEqual({
      type: "issue",
      number: 42,
      repo: "acme/sandbox",
      labels: ["@ghx-dev/eval", "eval"],
      metadata: {},
    })
  })

  it("calls gh issue create with expected arguments", async () => {
    mockExecFileResults(mockedExecFile, [
      { stdout: "https://github.com/acme/sandbox/issues/7\n", stderr: "" },
    ])

    const seeder = createIssueSeeder()
    await seeder.seed({
      repo: "acme/sandbox",
      name: "labeled_issue",
      labels: ["@ghx-dev/eval"],
    })

    const calls = mockedExecFile.mock.calls
    expect(calls).toHaveLength(1)

    const createCall = calls[0] as unknown[]

    // Only call: gh issue create
    expect(createCall[0]).toBe("gh")
    expect(createCall[1]).toEqual(
      expect.arrayContaining([
        "issue",
        "create",
        "--repo",
        "acme/sandbox",
        "--title",
        "[@ghx-dev/eval] labeled_issue",
        "--label",
        "@ghx-dev/eval",
      ]),
    )
  })

  it("throws when the URL returned by gh issue create cannot be parsed", async () => {
    mockExecFileResults(mockedExecFile, [{ stdout: "not-a-valid-url\n", stderr: "" }])

    const seeder = createIssueSeeder()

    await expect(
      seeder.seed({
        repo: "acme/sandbox",
        name: "ghost_issue",
        labels: ["@ghx-dev/eval"],
      }),
    ).rejects.toThrow(/could not parse issue number from url/i)
  })
})

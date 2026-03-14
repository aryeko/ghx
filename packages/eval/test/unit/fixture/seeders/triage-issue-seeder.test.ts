import * as childProcess from "node:child_process"
import { createTriageIssueSeeder } from "@eval/fixture/seeders/triage-issue-seeder.js"
import { afterEach, describe, expect, it, vi } from "vitest"
import { mockExecFileResults } from "./helpers.js"

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}))

const mockedExecFile = vi.mocked(childProcess.execFile)

describe("createTriageIssueSeeder", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a seeder with type 'issue_for_triage'", () => {
    const seeder = createTriageIssueSeeder()
    expect(seeder.type).toBe("issue_for_triage")
  })

  it("creates an issue with a detailed triage body", async () => {
    mockExecFileResults(mockedExecFile, [
      { stdout: "https://github.com/acme/sandbox/issues/10", stderr: "" },
    ])

    const seeder = createTriageIssueSeeder()
    const result = await seeder.seed({
      repo: "acme/sandbox",
      name: "issue_for_triage",
      labels: ["@ghx-dev/eval"],
    })

    expect(result).toEqual({
      type: "issue",
      number: 10,
      repo: "acme/sandbox",
      labels: ["@ghx-dev/eval"],
      metadata: {},
    })

    // Verify the body contains triage-relevant content
    const createCall = mockedExecFile.mock.calls[0] as unknown[]
    const args = createCall[1] as string[]
    const bodyIndex = args.indexOf("--body")
    const body = args[bodyIndex + 1]
    expect(body).toContain("Steps to reproduce")
    expect(body).toContain("Expected behavior")
    expect(body).toContain("Actual behavior")
  })
})

import * as childProcess from "node:child_process"
import { createTriageIssueSeeder } from "@eval/fixture/seeders/triage-issue-seeder.js"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}))

const mockedExecFile = vi.mocked(childProcess.execFile)

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

describe("createTriageIssueSeeder", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a seeder with type 'issue_for_triage'", () => {
    const seeder = createTriageIssueSeeder()
    expect(seeder.type).toBe("issue_for_triage")
  })

  it("creates an issue with a detailed triage body", async () => {
    mockExecFileResults([{ stdout: "https://github.com/acme/sandbox/issues/10", stderr: "" }])

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

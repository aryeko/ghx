import * as childProcess from "node:child_process"
import { createBugIssueSeeder } from "@eval/fixture/seeders/bug-issue-seeder.js"
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

describe("createBugIssueSeeder", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a seeder with type 'issue_bug_to_close'", () => {
    const seeder = createBugIssueSeeder()
    expect(seeder.type).toBe("issue_bug_to_close")
  })

  it("creates an issue with bug label and stores searchTerm in metadata", async () => {
    mockExecFileResults([{ stdout: "https://github.com/acme/sandbox/issues/20", stderr: "" }])

    const seeder = createBugIssueSeeder()
    const result = await seeder.seed({
      repo: "acme/sandbox",
      name: "issue_bug_to_close",
      labels: ["@ghx-dev/eval"],
    })

    expect(result).toEqual({
      type: "issue",
      number: 20,
      repo: "acme/sandbox",
      labels: ["@ghx-dev/eval", "bug"],
      metadata: { searchTerm: "Memory leak in connection pooling" },
    })
  })

  it("includes the bug label in gh issue create args", async () => {
    mockExecFileResults([{ stdout: "https://github.com/acme/sandbox/issues/5", stderr: "" }])

    const seeder = createBugIssueSeeder()
    await seeder.seed({
      repo: "acme/sandbox",
      name: "issue_bug_to_close",
      labels: ["@ghx-dev/eval"],
    })

    const createCall = mockedExecFile.mock.calls[0] as unknown[]
    const args = createCall[1] as string[]
    // Should have both @ghx-dev/eval and bug labels
    const labelIndices = args.reduce<number[]>((acc, arg, i) => {
      if (arg === "--label") acc.push(i)
      return acc
    }, [])
    const labels = labelIndices.map((i) => args[i + 1])
    expect(labels).toContain("@ghx-dev/eval")
    expect(labels).toContain("bug")
  })
})

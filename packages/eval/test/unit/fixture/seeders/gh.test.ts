import { execFile, spawn } from "node:child_process"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
}))

import {
  parseIssueNumberFromUrl,
  runGh,
  runGhWithInput,
  runGhWithToken,
} from "@eval/fixture/seeders/gh.js"

const mockExecFile = vi.mocked(execFile)
const mockSpawn = vi.mocked(spawn)

type DataHandler = (chunk: Buffer) => void
type CloseHandler = (code: number) => void
type ErrorHandler = (error: Error) => void

function makeSpawnMock(stdout: string, exitCode = 0, stderr = ""): void {
  mockSpawn.mockImplementation(() => {
    const stdoutHandlers: DataHandler[] = []
    const stderrHandlers: DataHandler[] = []
    const closeHandlers: CloseHandler[] = []
    return {
      stdout: {
        on: vi.fn((ev: string, cb: DataHandler) => {
          if (ev === "data") stdoutHandlers.push(cb)
        }),
      },
      stderr: {
        on: vi.fn((ev: string, cb: DataHandler) => {
          if (ev === "data") stderrHandlers.push(cb)
        }),
      },
      stdin: {
        on: vi.fn(),
        write: vi.fn(),
        end: vi.fn(() => {
          if (stdout) for (const cb of stdoutHandlers) cb(Buffer.from(stdout))
          if (stderr) for (const cb of stderrHandlers) cb(Buffer.from(stderr))
          for (const cb of closeHandlers) cb(exitCode)
        }),
      },
      on: vi.fn((ev: string, cb: CloseHandler) => {
        if (ev === "close") closeHandlers.push(cb)
      }),
    } as unknown as ReturnType<typeof spawn>
  })
}

function makeSpawnErrorMock(spawnError: Error): void {
  mockSpawn.mockImplementation(() => {
    const errorHandlers: ErrorHandler[] = []
    return {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      stdin: {
        on: vi.fn(),
        write: vi.fn(),
        end: vi.fn(() => {
          for (const cb of errorHandlers) cb(spawnError)
        }),
      },
      on: vi.fn((ev: string, cb: ErrorHandler) => {
        if (ev === "error") errorHandlers.push(cb)
      }),
    } as unknown as ReturnType<typeof spawn>
  })
}

describe("runGh", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("resolves with trimmed stdout on success", async () => {
    mockExecFile.mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as (err: Error | null, stdout: string) => void
      cb(null, "  hello world  ")
      return {} as ReturnType<typeof execFile>
    })

    const result = await runGh(["some", "args"])

    expect(result).toBe("hello world")
  })

  it("rejects with error when callback receives an error", async () => {
    const err = new Error("gh not found")
    mockExecFile.mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as (err: Error | null, stdout: string) => void
      cb(err, "")
      return {} as ReturnType<typeof execFile>
    })

    await expect(runGh(["some", "args"])).rejects.toThrow("gh not found")
  })
})

describe("runGhWithToken", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("resolves with trimmed stdout and passes GH_TOKEN and GITHUB_TOKEN in env", async () => {
    let capturedEnv: Record<string, string> | undefined

    mockExecFile.mockImplementation((...args: unknown[]) => {
      const opts = args[2] as { env?: Record<string, string> }
      capturedEnv = opts.env
      const cb = args[args.length - 1] as (err: Error | null, stdout: string) => void
      cb(null, "  token output  ")
      return {} as ReturnType<typeof execFile>
    })

    const result = await runGhWithToken(["api", "/user"], "my-secret-token")

    expect(result).toBe("token output")
    expect(capturedEnv?.GH_TOKEN).toBe("my-secret-token")
    expect(capturedEnv?.GITHUB_TOKEN).toBe("my-secret-token")
  })

  it("rejects with error when callback receives an error", async () => {
    const err = new Error("unauthorized")
    mockExecFile.mockImplementation((...args: unknown[]) => {
      const cb = args[args.length - 1] as (err: Error | null, stdout: string) => void
      cb(err, "")
      return {} as ReturnType<typeof execFile>
    })

    await expect(runGhWithToken(["api", "/user"], "bad-token")).rejects.toThrow("unauthorized")
  })
})

describe("runGhWithInput", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("resolves with trimmed stdout when process exits with code 0", async () => {
    makeSpawnMock("  spawn output  ", 0)

    const result = await runGhWithInput(["api", "--method", "POST"], '{"key":"value"}')

    expect(result).toBe("spawn output")
  })

  it("rejects with stderr message on non-zero exit code", async () => {
    makeSpawnMock("", 1, "some error from stderr")

    await expect(runGhWithInput(["api", "--method", "POST"], "{}")).rejects.toThrow(
      "some error from stderr",
    )
  })

  it("rejects with 'gh exited with code N' when stderr is empty on non-zero exit", async () => {
    makeSpawnMock("", 2, "")

    await expect(runGhWithInput(["api", "--method", "POST"], "{}")).rejects.toThrow(
      "gh exited with code 2",
    )
  })

  it("rejects with the spawn error when the process emits an error event", async () => {
    const spawnError = new Error("spawn gh ENOENT")
    makeSpawnErrorMock(spawnError)

    await expect(runGhWithInput(["api", "--method", "POST"], "{}")).rejects.toThrow(
      "spawn gh ENOENT",
    )
  })
})

describe("parseIssueNumberFromUrl", () => {
  it("extracts issue number from standard GitHub URL", () => {
    expect(parseIssueNumberFromUrl("https://github.com/owner/repo/issues/42")).toBe(42)
  })

  it("extracts large issue numbers", () => {
    expect(parseIssueNumberFromUrl("https://github.com/owner/repo/issues/12345")).toBe(12345)
  })

  it("throws on PR URL", () => {
    expect(() => parseIssueNumberFromUrl("https://github.com/owner/repo/pull/10")).toThrow(
      "Could not parse issue number",
    )
  })

  it("throws on URL with trailing whitespace", () => {
    // gh output sometimes has trailing newlines -- but runGh trims, so this shouldn't happen.
    // Still good to know the behavior.
    expect(() => parseIssueNumberFromUrl("https://github.com/owner/repo/issues/42\n")).toThrow(
      "Could not parse issue number",
    )
  })

  it("throws on URL with query params", () => {
    expect(() =>
      parseIssueNumberFromUrl("https://github.com/owner/repo/issues/42?foo=bar"),
    ).toThrow("Could not parse issue number")
  })

  it("throws on empty string", () => {
    expect(() => parseIssueNumberFromUrl("")).toThrow("Could not parse issue number")
  })

  it("throws on non-URL string", () => {
    expect(() => parseIssueNumberFromUrl("not-a-url")).toThrow("Could not parse issue number")
  })
})

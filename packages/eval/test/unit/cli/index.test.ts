import { fileURLToPath } from "node:url"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Absolute path to the CLI entry point — must match import.meta.url inside index.ts
const INDEX_PATH = fileURLToPath(new URL("../../../src/cli/index.ts", import.meta.url))

describe("CLI program structure", () => {
  it("registers all expected subcommands", async () => {
    const { createProgram } = await import("@eval/cli/index.js")
    const program = createProgram()
    const names = program.commands.map((c) => c.name())
    expect(names).toContain("run")
    expect(names).toContain("analyze")
    expect(names).toContain("report")
    expect(names).toContain("check")
    expect(names).toContain("fixture")
  })

  it("program name is eval", async () => {
    const { createProgram } = await import("@eval/cli/index.js")
    expect(createProgram().name()).toBe("eval")
  })

  it("exits on unknown command", async () => {
    const { createProgram } = await import("@eval/cli/index.js")
    const program = createProgram()
    program.exitOverride()
    await expect(program.parseAsync(["unknown-cmd"], { from: "user" })).rejects.toThrow()
  })

  it("fixture command registers seed, status, cleanup subcommands", async () => {
    const { createProgram } = await import("@eval/cli/index.js")
    const program = createProgram()
    const fixtureCmd = program.commands.find((c) => c.name() === "fixture")
    expect(fixtureCmd).toBeDefined()
    const subNames = fixtureCmd?.commands.map((c) => c.name()) ?? []
    expect(subNames).toContain("seed")
    expect(subNames).toContain("status")
    expect(subNames).toContain("cleanup")
  })
})

describe("direct run initialization", () => {
  let origArgv1: string | undefined
  let consoleErrorSpy: { mockRestore: () => void }
  let processExitSpy: { mockRestore: () => void }

  beforeEach(() => {
    origArgv1 = process.argv[1]
    process.argv[1] = INDEX_PATH
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never)
  })

  afterEach(() => {
    if (origArgv1 !== undefined) {
      process.argv[1] = origArgv1
    }
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
    vi.doUnmock("commander")
    vi.resetModules()
  })

  it("calls parseAsync and reports error when run directly as index script", async () => {
    const mockParseAsync = vi.fn().mockRejectedValue(new Error("startup-error"))

    vi.doMock("commander", () => {
      const mockCmdInstance = {
        description: vi.fn().mockReturnThis(),
        addCommand: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn().mockReturnThis(),
        parseAsync: mockParseAsync,
        name: vi.fn().mockReturnValue("eval"),
        commands: [],
      }
      return { Command: vi.fn(() => mockCmdInstance) }
    })

    vi.resetModules()
    await import("@eval/cli/index.js")
    // flush microtask queue so the unhandled .catch() runs
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mockParseAsync).toHaveBeenCalledWith(process.argv)
    expect(consoleErrorSpy).toHaveBeenCalledWith("startup-error")
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })

  it("formats non-Error rejection with String() when run directly", async () => {
    const mockParseAsync = vi.fn().mockRejectedValue("plain-string-error")

    vi.doMock("commander", () => {
      const mockCmdInstance = {
        description: vi.fn().mockReturnThis(),
        addCommand: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn().mockReturnThis(),
        parseAsync: mockParseAsync,
        name: vi.fn().mockReturnValue("eval"),
        commands: [],
      }
      return { Command: vi.fn(() => mockCmdInstance) }
    })

    vi.resetModules()
    await import("@eval/cli/index.js")
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(consoleErrorSpy).toHaveBeenCalledWith("plain-string-error")
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })
})

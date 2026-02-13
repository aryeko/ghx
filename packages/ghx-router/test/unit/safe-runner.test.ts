import { describe, expect, it } from "vitest"

import { createSafeCliCommandRunner } from "../../src/core/execution/cli/safe-runner.js"

describe("createSafeCliCommandRunner", () => {
  it("returns stdout, stderr, and exitCode for successful command", async () => {
    const runner = createSafeCliCommandRunner()

    const result = await runner.run(
      process.execPath,
      ["-e", "process.stdout.write('ok'); process.stderr.write('warn')"],
      1000
    )

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe("ok")
    expect(result.stderr).toBe("warn")
  })

  it("rejects when command exceeds timeout", async () => {
    const runner = createSafeCliCommandRunner()

    await expect(
      runner.run(process.execPath, ["-e", "setTimeout(() => {}, 1000)"], 20)
    ).rejects.toThrow("timed out")
  })

  it("rejects when combined output exceeds configured bounds", async () => {
    const runner = createSafeCliCommandRunner({ maxOutputBytes: 64 })

    await expect(
      runner.run(process.execPath, ["-e", "process.stdout.write('x'.repeat(256))"], 1000)
    ).rejects.toThrow("output exceeded")
  })

  it("rejects when spawn fails", async () => {
    const runner = createSafeCliCommandRunner()

    await expect(runner.run("definitely-not-a-real-command-ghx", [], 1000)).rejects.toThrow()
  })
})

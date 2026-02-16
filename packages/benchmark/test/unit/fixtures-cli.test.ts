import { describe, expect, it } from "vitest"

import { parseArgs } from "../../src/cli/fixtures.js"

describe("fixtures CLI args", () => {
  it("parses seed command flags", () => {
    const parsed = parseArgs([
      "seed",
      "--repo",
      "aryeko/ghx-bench-fixtures",
      "--out",
      "fixtures/latest.json",
      "--seed-id",
      "nightly"
    ])

    expect(parsed.command).toBe("seed")
    expect(parsed.repo).toBe("aryeko/ghx-bench-fixtures")
    expect(parsed.outFile).toBe("fixtures/latest.json")
    expect(parsed.seedId).toBe("nightly")
  })

  it("defaults to status command when omitted", () => {
    const parsed = parseArgs([])
    expect(parsed.command).toBe("status")
  })

  it("supports pnpm forwarded args with separator", () => {
    const parsed = parseArgs(["--", "seed", "--seed-id", "nightly"])
    expect(parsed.command).toBe("seed")
    expect(parsed.seedId).toBe("nightly")
  })

  it("rejects unsupported command", () => {
    expect(() => parseArgs(["unknown"])).toThrow("Unsupported fixtures command")
  })
})

import { describe, expect, it } from "vitest"

import { parseCliArgs } from "../../src/cli/args.js"

describe("parseCliArgs", () => {
  it("parses mode, reps, and scenario", () => {
    const parsed = parseCliArgs(["run", "agent_direct", "3", "--scenario", "pr-view-001"])

    expect(parsed.command).toBe("run")
    expect(parsed.mode).toBe("agent_direct")
    expect(parsed.repetitions).toBe(3)
    expect(parsed.scenarioFilter).toBe("pr-view-001")
    expect(parsed.scenarioSet).toBeNull()
  })

  it("parses scenario-set flag", () => {
    const parsed = parseCliArgs(["run", "ghx", "1", "--scenario-set", "pr-review-reads"])

    expect(parsed.scenarioSet).toBe("pr-review-reads")
    expect(parsed.scenarioFilter).toBeNull()
  })

  it("parses fixture manifest options", () => {
    const parsed = parseCliArgs([
      "run",
      "ghx",
      "2",
      "--scenario-set",
      "full-seeded",
      "--fixture-manifest",
      "fixtures/latest.json",
      "--seed-if-missing"
    ])

    expect(parsed.fixtureManifestPath).toBe("fixtures/latest.json")
    expect(parsed.seedIfMissing).toBe(true)
  })

  it("defaults repetitions to 1 when omitted", () => {
    const parsed = parseCliArgs(["run", "agent_direct"])

    expect(parsed.repetitions).toBe(1)
  })

  it("supports pnpm forwarded args with separator", () => {
    const parsed = parseCliArgs(["run", "--", "--scenario", "pr-view-001"])

    expect(parsed.mode).toBe("ghx")
    expect(parsed.repetitions).toBe(1)
    expect(parsed.scenarioFilter).toBe("pr-view-001")
  })

  it("supports inline scenario flag without positional args", () => {
    const parsed = parseCliArgs(["run", "--scenario=issue-view-001"])

    expect(parsed.mode).toBe("ghx")
    expect(parsed.repetitions).toBe(1)
    expect(parsed.scenarioFilter).toBe("issue-view-001")
  })

  it("supports inline scenario-set flag", () => {
    const parsed = parseCliArgs(["run", "--scenario-set=ci-diagnostics"])

    expect(parsed.mode).toBe("ghx")
    expect(parsed.repetitions).toBe(1)
    expect(parsed.scenarioSet).toBe("ci-diagnostics")
  })

  it("treats --scenario-set with missing value as unset", () => {
    const parsed = parseCliArgs(["run", "--scenario-set"])
    expect(parsed.scenarioSet).toBeNull()
  })

  it("rejects unsupported commands and modes", () => {
    expect(() => parseCliArgs(["validate"])).toThrow("Unsupported command")
    expect(() => parseCliArgs(["run", "invalid_mode"])).toThrow("Unsupported mode")
  })

  it("rejects invalid repetitions", () => {
    expect(() => parseCliArgs(["run", "ghx", "0"])).toThrow("Invalid repetitions")
    expect(() => parseCliArgs(["run", "ghx", "1.5"])).toThrow("Invalid repetitions")
  })
})

import { cohensD, compareGroups, permutationTest } from "@profiler/stats/comparison.js"
import { describe, expect, it } from "vitest"

describe("cohensD", () => {
  it.each([
    [[], [1, 2]],
    [[1, 2], []],
  ])("returns a negligible effect when either group is empty", (groupA, groupB) => {
    expect(cohensD(groupA, groupB)).toEqual({ d: 0, magnitude: "negligible" })
  })

  it("returns d=0 and magnitude negligible for identical groups", () => {
    const group = [5, 5, 5, 5, 5]
    const result = cohensD(group, group)
    expect(result.d).toBe(0)
    expect(result.magnitude).toBe("negligible")
  })

  it("returns expected magnitude for known difference", () => {
    // Large effect: groups separated by several stddevs
    const groupA = [10, 11, 12, 13, 14]
    const groupB = [1, 2, 3, 4, 5]
    const result = cohensD(groupA, groupB)
    expect(result.magnitude).toBe("large")
    expect(result.d).toBeGreaterThan(0)
  })

  it("returns d=0 when pooled stddev is zero", () => {
    const result = cohensD([3, 3, 3], [3, 3, 3])
    expect(result.d).toBe(0)
    expect(result.magnitude).toBe("negligible")
  })

  it.each([
    [[1, 2, 3, 4, 5], [0.6, 1.6, 2.6, 3.6, 4.6], "small"],
    [[1, 2, 3, 4, 5], [0, 1, 2, 3, 4], "medium"],
  ] as const)("classifies non-negligible effects", (groupA, groupB, magnitude) => {
    expect(cohensD(groupA, groupB).magnitude).toBe(magnitude)
  })
})

describe("permutationTest", () => {
  it("uses stable defaults when options are omitted", () => {
    const first = permutationTest([1, 2], [3, 4])
    const second = permutationTest([1, 2], [3, 4])
    expect(first).toEqual(second)
  })

  it("returns immediately when zero permutations are requested", () => {
    expect(permutationTest([1], [2], { permutations: 0 })).toEqual({
      pValue: 1,
      observedDifference: 0,
      permutations: 0,
    })
  })

  it.each([
    [[], [1]],
    [[1], []],
  ])("returns immediately when either group is empty", (groupA, groupB) => {
    expect(permutationTest(groupA, groupB, { permutations: 5 })).toEqual({
      pValue: 1,
      observedDifference: 0,
      permutations: 5,
    })
  })

  it.each([
    ["less", [1, 1, 1], [1, 1, 1]],
    ["less", [1, 2, 3], [4, 5, 6]],
    ["greater", [1, 1, 1], [1, 1, 1]],
    ["greater", [4, 5, 6], [1, 2, 3]],
  ] as const)("supports the %s alternative", (alternative, groupA, groupB) => {
    const result = permutationTest(groupA, groupB, {
      alternative,
      seed: 7,
      permutations: 20,
    })
    expect(result.permutations).toBe(20)
    expect(result.pValue).toBeGreaterThanOrEqual(0)
    expect(result.pValue).toBeLessThanOrEqual(1)
  })

  it("returns high pValue for identical groups", () => {
    const group = [5, 5, 5, 5, 5]
    const result = permutationTest(group, group, {
      seed: 42,
      permutations: 1000,
    })
    expect(result.pValue).toBeGreaterThan(0.5)
  })

  it("returns low pValue for clearly different groups", () => {
    const groupA = [100, 101, 102, 103, 104]
    const groupB = [1, 2, 3, 4, 5]
    const result = permutationTest(groupA, groupB, {
      seed: 42,
      permutations: 1000,
    })
    expect(result.pValue).toBeLessThan(0.1)
  })

  it("is deterministic with same seed", () => {
    const a = [1, 2, 3, 4, 5]
    const b = [6, 7, 8, 9, 10]
    const r1 = permutationTest(a, b, { seed: 77, permutations: 500 })
    const r2 = permutationTest(a, b, { seed: 77, permutations: 500 })
    expect(r1.pValue).toBe(r2.pValue)
    expect(r1.observedDifference).toBe(r2.observedDifference)
  })
})

describe("compareGroups", () => {
  it("returns correctly shaped ComparisonResult", () => {
    const result = compareGroups(
      "ghx",
      [10, 12, 11, 13, 10],
      "agent_direct",
      [20, 22, 21, 23, 20],
      "total_tokens",
      {
        bootstrapOptions: { seed: 42, resamples: 500 },
        permutationOptions: { seed: 42, permutations: 500 },
      },
    )

    expect(result.modeA).toBe("ghx")
    expect(result.modeB).toBe("agent_direct")
    expect(result.metric).toBe("total_tokens")
    expect(typeof result.reductionPct).toBe("number")
    expect(result.ci95).toHaveLength(2)
    expect(typeof result.ci95[0]).toBe("number")
    expect(typeof result.ci95[1]).toBe("number")
    expect(typeof result.effectSize).toBe("number")
    expect(["negligible", "small", "medium", "large"]).toContain(result.effectMagnitude)
    expect(typeof result.pValue).toBe("number")
  })
})

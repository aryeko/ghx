import { bootstrapCI, bootstrapReductionCI } from "@profiler/stats/bootstrap.js"
import { describe, expect, it } from "vitest"

describe("bootstrapCI", () => {
  it("uses stable defaults when options are omitted", () => {
    expect(bootstrapCI([1, 2, 3])).toEqual(bootstrapCI([1, 2, 3]))
  })

  it("supports a custom statistic and confidence level", () => {
    const result = bootstrapCI([1, 2, 3], {
      statistic: (values) => Math.max(...values),
      confidenceLevel: 0.8,
      resamples: 20,
      seed: 1,
    })
    expect(result.pointEstimate).toBe(3)
    expect(result.confidenceLevel).toBe(0.8)
  })

  it("returns interval containing point estimate", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const result = bootstrapCI(values, { seed: 123, resamples: 1000 })
    expect(result.lower).toBeLessThanOrEqual(result.pointEstimate)
    expect(result.upper).toBeGreaterThanOrEqual(result.pointEstimate)
  })

  it("produces deterministic results with same seed", () => {
    const values = [10, 20, 30, 40, 50]
    const a = bootstrapCI(values, { seed: 99, resamples: 500 })
    const b = bootstrapCI(values, { seed: 99, resamples: 500 })
    expect(a.lower).toBe(b.lower)
    expect(a.upper).toBe(b.upper)
    expect(a.pointEstimate).toBe(b.pointEstimate)
  })

  it("returns degenerate interval for empty array", () => {
    const result = bootstrapCI([])
    expect(result.lower).toBe(0)
    expect(result.upper).toBe(0)
    expect(result.pointEstimate).toBe(0)
  })

  it("returns point estimate for both bounds on single element", () => {
    const result = bootstrapCI([42])
    expect(result.lower).toBe(42)
    expect(result.upper).toBe(42)
    expect(result.pointEstimate).toBe(42)
  })
})

describe("bootstrapReductionCI", () => {
  it("uses stable defaults when options are omitted", () => {
    expect(bootstrapReductionCI([1, 2], [3, 4])).toEqual(bootstrapReductionCI([1, 2], [3, 4]))
  })

  it("returns a zero reduction when the baseline statistic is zero", () => {
    expect(bootstrapReductionCI([1, 2], [0, 0], { resamples: 20 }).pointEstimate).toBe(0)
  })

  it.each([
    [[1], [2, 3]],
    [[1, 2], [3]],
  ])("returns a degenerate interval when either sample is too small", (modeA, modeB) => {
    const result = bootstrapReductionCI(modeA, modeB)
    expect(result.lower).toBe(result.pointEstimate)
    expect(result.upper).toBe(result.pointEstimate)
  })

  it("produces reasonable reduction range for known inputs", () => {
    // modeA is consistently lower than modeB => positive reduction
    const modeA = [10, 12, 11, 13, 10]
    const modeB = [20, 22, 21, 23, 20]
    const result = bootstrapReductionCI(modeA, modeB, {
      seed: 42,
      resamples: 1000,
    })
    // reduction should be around 45-55%
    expect(result.pointEstimate).toBeGreaterThan(30)
    expect(result.pointEstimate).toBeLessThan(70)
    expect(result.lower).toBeLessThanOrEqual(result.pointEstimate)
    expect(result.upper).toBeGreaterThanOrEqual(result.pointEstimate)
  })
})

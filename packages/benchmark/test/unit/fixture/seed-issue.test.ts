import { beforeEach, describe, expect, it, vi } from "vitest"

const runGhJsonMock = vi.hoisted(() => vi.fn())

vi.mock("@bench/fixture/gh-client.js", () => ({
  runGhJson: runGhJsonMock,
}))

import { findOrCreateIssue } from "@bench/fixture/seed-issue.js"

describe("findOrCreateIssue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns existing issue when found", () => {
    runGhJsonMock.mockReturnValueOnce([
      { id: "I_1", number: 10, url: "https://github.com/aryeko/ghx-bench-fixtures/issues/10" },
    ])

    const result = findOrCreateIssue("aryeko/ghx-bench-fixtures", "bench-seed:test-1")

    expect(result).toEqual({
      id: "I_1",
      number: 10,
      url: "https://github.com/aryeko/ghx-bench-fixtures/issues/10",
    })
    expect(runGhJsonMock).toHaveBeenCalledTimes(1)
  })

  it("creates and returns issue when not found", () => {
    runGhJsonMock
      .mockReturnValueOnce([]) // list returns empty
      .mockReturnValueOnce({ number: 5 }) // create returns number
      .mockReturnValueOnce({
        id: "I_5",
        number: 5,
        url: "https://github.com/aryeko/ghx-bench-fixtures/issues/5",
      }) // view returns full issue

    const result = findOrCreateIssue("aryeko/ghx-bench-fixtures", "bench-seed:test-1")

    expect(result).toEqual({
      id: "I_5",
      number: 5,
      url: "https://github.com/aryeko/ghx-bench-fixtures/issues/5",
    })
    expect(runGhJsonMock).toHaveBeenCalledTimes(3)
  })

  it("throws when created issue number is 0", () => {
    runGhJsonMock.mockReturnValueOnce([]).mockReturnValueOnce({ number: 0 })

    expect(() => {
      findOrCreateIssue("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    }).toThrow("failed to create fixture issue")
  })

  it("throws when created issue number is not an integer", () => {
    runGhJsonMock.mockReturnValueOnce([]).mockReturnValueOnce({ number: 3.5 })

    expect(() => {
      findOrCreateIssue("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    }).toThrow("failed to create fixture issue")
  })

  it("throws when created issue number is negative", () => {
    runGhJsonMock.mockReturnValueOnce([]).mockReturnValueOnce({ number: -1 })

    expect(() => {
      findOrCreateIssue("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    }).toThrow("failed to create fixture issue")
  })

  it("parses response with items property", () => {
    runGhJsonMock.mockReturnValueOnce({
      items: [
        { id: "I_2", number: 20, url: "https://github.com/aryeko/ghx-bench-fixtures/issues/20" },
      ],
    })

    const result = findOrCreateIssue("aryeko/ghx-bench-fixtures", "bench-seed:test-1")

    expect(result).toEqual({
      id: "I_2",
      number: 20,
      url: "https://github.com/aryeko/ghx-bench-fixtures/issues/20",
    })
  })

  it("returns null from items when list is empty", () => {
    runGhJsonMock
      .mockReturnValueOnce({ items: [] })
      .mockReturnValueOnce({ number: 7 })
      .mockReturnValueOnce({
        id: "I_7",
        number: 7,
        url: "https://github.com/aryeko/ghx-bench-fixtures/issues/7",
      })

    const result = findOrCreateIssue("aryeko/ghx-bench-fixtures", "bench-seed:test-1")

    expect(result).toEqual({
      id: "I_7",
      number: 7,
      url: "https://github.com/aryeko/ghx-bench-fixtures/issues/7",
    })
  })

  it("returns null when existing item has wrong types", () => {
    runGhJsonMock
      .mockReturnValueOnce([{ id: 123, number: "bad", url: "https://..." }])
      .mockReturnValueOnce({ number: 9 })
      .mockReturnValueOnce({
        id: "I_9",
        number: 9,
        url: "https://github.com/aryeko/ghx-bench-fixtures/issues/9",
      })

    const result = findOrCreateIssue("aryeko/ghx-bench-fixtures", "bench-seed:test-1")

    expect(result).toEqual({
      id: "I_9",
      number: 9,
      url: "https://github.com/aryeko/ghx-bench-fixtures/issues/9",
    })
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"

const runGhMock = vi.hoisted(() => vi.fn())
const tryRunGhMock = vi.hoisted(() => vi.fn())
const runGhJsonMock = vi.hoisted(() => vi.fn())
const tryRunGhJsonMock = vi.hoisted(() => vi.fn())
const runGhWithTokenMock = vi.hoisted(() => vi.fn())
const tryRunGhWithTokenMock = vi.hoisted(() => vi.fn())

vi.mock("@bench/fixture/gh-client.js", () => ({
  runGh: runGhMock,
  tryRunGh: tryRunGhMock,
  runGhJson: runGhJsonMock,
  tryRunGhJson: tryRunGhJsonMock,
  runGhWithToken: runGhWithTokenMock,
  tryRunGhWithToken: tryRunGhWithTokenMock,
}))

import {
  createPrWithMixedThreads,
  createPrWithReviews,
  createSeedPr,
  ensurePrThread,
  findSeededPr,
  resetMixedPrThreads,
  resetPrReviewThreads,
} from "@bench/fixture/seed-pr.js"

describe("findSeededPr", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns null when tryRunGhJson returns empty list", () => {
    tryRunGhJsonMock.mockReturnValue([])
    const result = findSeededPr("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    expect(result).toBeNull()
  })

  it("returns pr with id and number when found", () => {
    tryRunGhJsonMock.mockReturnValue([{ id: "PR_1", number: 42 }])
    const result = findSeededPr("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    expect(result).toEqual({ id: "PR_1", number: 42 })
  })

  it("returns null when list item has wrong types", () => {
    tryRunGhJsonMock.mockReturnValue([{ id: 123, number: "bad" }])
    const result = findSeededPr("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    expect(result).toBeNull()
  })

  it("returns null when tryRunGhJson returns null", () => {
    tryRunGhJsonMock.mockReturnValue(null)
    const result = findSeededPr("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    expect(result).toBeNull()
  })

  it("returns null when first item is not an object", () => {
    tryRunGhJsonMock.mockReturnValue(["string"])
    const result = findSeededPr("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    expect(result).toBeNull()
  })

  it("parses response with items property", () => {
    tryRunGhJsonMock.mockReturnValue({ items: [{ id: "PR_2", number: 5 }] })
    const result = findSeededPr("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    expect(result).toEqual({ id: "PR_2", number: 5 })
  })
})

describe("createSeedPr", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("creates pr successfully with happy path", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT
      .mockReturnValueOnce({ number: 5, node_id: "PR_NODE_5" }) // PR create

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([]) // PR list (no existing)

    tryRunGhMock.mockReturnValue("") // label add

    const result = createSeedPr("aryeko/ghx-bench-fixtures", "seed-123", "bench-seed:test-1")

    expect(result).toEqual({ id: "PR_NODE_5", number: 5 })
    expect(runGhJsonMock).toHaveBeenCalledWith([
      "api",
      "repos/aryeko/ghx-bench-fixtures/git/ref/heads/main",
    ])
    expect(runGhJsonMock).toHaveBeenCalledTimes(3)
  })

  it("throws when base sha is empty", () => {
    runGhJsonMock.mockReturnValueOnce({ object: { sha: "" } })

    expect(() => {
      createSeedPr("aryeko/ghx-bench-fixtures", "seed-123", "bench-seed:test-1")
    }).toThrow("unable to resolve base sha for fixture PR creation")
  })

  it("throws when base sha is missing", () => {
    runGhJsonMock.mockReturnValueOnce({ object: {} })

    expect(() => {
      createSeedPr("aryeko/ghx-bench-fixtures", "seed-123", "bench-seed:test-1")
    }).toThrow("unable to resolve base sha for fixture PR creation")
  })

  it("throws when PR creation returns invalid number", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT
      .mockReturnValueOnce({ number: 0, node_id: "PR_NODE_5" }) // PR create

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([]) // PR list

    expect(() => {
      createSeedPr("aryeko/ghx-bench-fixtures", "seed-123", "bench-seed:test-1")
    }).toThrow("failed to create fixture PR")
  })

  it("throws when node_id is missing", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT
      .mockReturnValueOnce({ number: 5 }) // PR create (no node_id)

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([]) // PR list

    expect(() => {
      createSeedPr("aryeko/ghx-bench-fixtures", "seed-123", "bench-seed:test-1")
    }).toThrow("failed to create fixture PR")
  })

  it("returns existing PR without creating new one", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([{ id: "PR_EXISTING", number: 99 }]) // PR list - found!

    const result = createSeedPr("aryeko/ghx-bench-fixtures", "seed-123", "bench-seed:test-1")

    expect(result).toEqual({ id: "PR_EXISTING", number: 99 })
    expect(runGhJsonMock).toHaveBeenCalledTimes(2) // doesn't create new PR
  })
})

describe("createPrWithReviews", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("creates pr with reviews successfully", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT
      .mockReturnValueOnce({ number: 5, node_id: "PR_NODE_5" }) // PR create

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([]) // PR list (no existing)
      .mockReturnValueOnce({ headRefOid: "def456" }) // getPrHeadSha
      .mockReturnValueOnce({
        data: { repository: { pullRequest: { reviewThreads: { totalCount: 0 } } } },
      }) // countPrThreads
      .mockReturnValueOnce({
        data: { repository: { pullRequest: { reviewThreads: { nodes: [{ id: "THREAD_1" }] } } } },
      }) // findPrThreadId

    // Add 4 review comments + resolve first thread
    tryRunGhWithTokenMock
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})

    tryRunGhMock.mockReturnValue("") // label add

    const result = createPrWithReviews(
      "aryeko/ghx-bench-fixtures",
      "seed-123",
      "bench-seed:test-1",
      "reviewer-token",
    )

    expect(result).toEqual({ id: "PR_NODE_5", number: 5, thread_count: 4 })
    expect(tryRunGhWithTokenMock).toHaveBeenCalledTimes(5) // 4 comments + 1 resolve
  })

  it("throws when unable to resolve head sha for review comments", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT
      .mockReturnValueOnce({ number: 5, node_id: "PR_NODE_5" }) // PR create

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([]) // PR list
      .mockReturnValueOnce(null) // getPrHeadSha → null → throws

    tryRunGhMock.mockReturnValue("") // label add

    expect(() => {
      createPrWithReviews(
        "aryeko/ghx-bench-fixtures",
        "seed-123",
        "bench-seed:test-1",
        "reviewer-token",
      )
    }).toThrow("unable to resolve head sha for review comments")
  })

  it("reuses existing PR", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([{ id: "PR_EXISTING", number: 99 }]) // PR list - found!
      .mockReturnValueOnce({ headRefOid: "def456" }) // getPrHeadSha
      .mockReturnValueOnce({
        data: { repository: { pullRequest: { reviewThreads: { totalCount: 0 } } } },
      }) // countPrThreads
      .mockReturnValueOnce({
        data: { repository: { pullRequest: { reviewThreads: { nodes: [{ id: "THREAD_1" }] } } } },
      }) // findPrThreadId

    tryRunGhWithTokenMock
      .mockReturnValueOnce({}) // comment 1
      .mockReturnValueOnce({}) // comment 2
      .mockReturnValueOnce({}) // comment 3
      .mockReturnValueOnce({}) // comment 4
      .mockReturnValueOnce({}) // resolve first thread

    tryRunGhMock.mockReturnValue("")

    const result = createPrWithReviews(
      "aryeko/ghx-bench-fixtures",
      "seed-123",
      "bench-seed:test-1",
      "reviewer-token",
    )

    expect(result.number).toBe(99)
    expect(runGhJsonMock).toHaveBeenCalledTimes(2) // doesn't create new PR
  })
})

describe("createPrWithMixedThreads", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("creates pr with mixed threads successfully", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT
      .mockReturnValueOnce({ number: 5, node_id: "PR_NODE_5" }) // PR create

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([]) // PR list (no existing)
      .mockReturnValueOnce({ headRefOid: "def456" }) // getPrHeadSha
      .mockReturnValueOnce({
        data: { repository: { pullRequest: { reviewThreads: { totalCount: 0 } } } },
      }) // countPrThreads
      // resolveThreadId × 4
      .mockReturnValueOnce({
        data: { repository: { pullRequest: { reviewThreads: { nodes: [{ id: "T0" }] } } } },
      })
      .mockReturnValueOnce({
        data: {
          repository: { pullRequest: { reviewThreads: { nodes: [{ id: "T0" }, { id: "T1" }] } } },
        },
      })
      .mockReturnValueOnce({
        data: {
          repository: {
            pullRequest: { reviewThreads: { nodes: [{ id: "T0" }, { id: "T1" }, { id: "T2" }] } },
          },
        },
      })
      .mockReturnValueOnce({
        data: {
          repository: {
            pullRequest: {
              reviewThreads: { nodes: [{ id: "T0" }, { id: "T1" }, { id: "T2" }, { id: "T3" }] },
            },
          },
        },
      })

    // 7 comment adds + 4 resolves
    tryRunGhWithTokenMock
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})

    tryRunGhMock.mockReturnValue("") // label add

    const result = createPrWithMixedThreads(
      "aryeko/ghx-bench-fixtures",
      "seed-123",
      "bench-seed:test-1",
      "reviewer-token",
    )

    expect(result).toEqual({
      id: "PR_NODE_5",
      number: 5,
      resolved_count: 4,
      unresolved_count: 3,
    })
    expect(tryRunGhWithTokenMock).toHaveBeenCalledTimes(11) // 7 comments + 4 resolves
  })

  it("handles case when fewer than 4 threads exist", () => {
    // 7 comments added, but nodes only ever contain 2 threads → resolveCount = min(4, 7) = 4
    // but resolveThreadId returns null for indices 2 and 3 → only 2 actual resolves
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT
      .mockReturnValueOnce({ number: 5, node_id: "PR_NODE_5" }) // PR create

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([]) // PR list
      .mockReturnValueOnce({ headRefOid: "def456" }) // getPrHeadSha
      .mockReturnValueOnce({
        data: { repository: { pullRequest: { reviewThreads: { totalCount: 0 } } } },
      }) // countPrThreads
      // resolveThreadId × 4 (indices 2 and 3 return null because nodes.length = 2)
      .mockReturnValueOnce({
        data: { repository: { pullRequest: { reviewThreads: { nodes: [{ id: "T0" }] } } } },
      })
      .mockReturnValueOnce({
        data: {
          repository: { pullRequest: { reviewThreads: { nodes: [{ id: "T0" }, { id: "T1" }] } } },
        },
      })
      .mockReturnValueOnce({
        data: {
          repository: { pullRequest: { reviewThreads: { nodes: [{ id: "T0" }, { id: "T1" }] } } },
        },
      })
      .mockReturnValueOnce({
        data: {
          repository: { pullRequest: { reviewThreads: { nodes: [{ id: "T0" }, { id: "T1" }] } } },
        },
      })

    tryRunGhWithTokenMock
      // 7 comment adds
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      // 2 resolves (only 2 threads have valid IDs at their indices)
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})

    tryRunGhMock.mockReturnValue("") // label add

    const result = createPrWithMixedThreads(
      "aryeko/ghx-bench-fixtures",
      "seed-123",
      "bench-seed:test-1",
      "reviewer-token",
    )

    expect(result.resolved_count).toBe(4)
    expect(result.unresolved_count).toBe(3)
  })
})

describe("resetPrReviewThreads", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("unresolves all threads and resolves first one", () => {
    tryRunGhJsonMock.mockReturnValue({
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [{ id: "t1" }, { id: "t2" }, { id: "t3" }],
            },
          },
        },
      },
    })

    // 3 unresolves + 1 resolve first thread
    tryRunGhWithTokenMock
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})

    resetPrReviewThreads("aryeko/ghx-bench-fixtures", 42, "reviewer-token")

    expect(tryRunGhWithTokenMock).toHaveBeenCalledTimes(4)
    expect(tryRunGhWithTokenMock).toHaveBeenCalledWith(
      expect.arrayContaining(["api", "graphql"]),
      "reviewer-token",
    )
  })

  it("handles case with no threads", () => {
    tryRunGhJsonMock.mockReturnValue({
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [],
            },
          },
        },
      },
    })

    resetPrReviewThreads("aryeko/ghx-bench-fixtures", 42, "reviewer-token")

    expect(tryRunGhWithTokenMock).not.toHaveBeenCalled()
  })
})

describe("resetMixedPrThreads", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("unresolves all threads and resolves first 4", () => {
    tryRunGhJsonMock.mockReturnValue({
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [
                { id: "t1" },
                { id: "t2" },
                { id: "t3" },
                { id: "t4" },
                { id: "t5" },
                { id: "t6" },
                { id: "t7" },
              ],
            },
          },
        },
      },
    })

    // 7 unresolves + 4 resolves
    tryRunGhWithTokenMock
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})

    resetMixedPrThreads("aryeko/ghx-bench-fixtures", 42, "reviewer-token")

    expect(tryRunGhWithTokenMock).toHaveBeenCalledTimes(11)
  })

  it("handles case with fewer than 4 threads", () => {
    tryRunGhJsonMock.mockReturnValue({
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [{ id: "t1" }, { id: "t2" }],
            },
          },
        },
      },
    })

    // 2 unresolves + 2 resolves
    tryRunGhWithTokenMock
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})

    resetMixedPrThreads("aryeko/ghx-bench-fixtures", 42, "reviewer-token")

    expect(tryRunGhWithTokenMock).toHaveBeenCalledTimes(4)
  })
})

describe("ensurePrThread", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns existing thread id when found", () => {
    tryRunGhJsonMock.mockReturnValue({
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [{ id: "EXISTING_THREAD" }],
            },
          },
        },
      },
    })

    const result = ensurePrThread("aryeko/ghx-bench-fixtures", 42, "seed-123")

    expect(result).toBe("EXISTING_THREAD")
    expect(tryRunGhMock).not.toHaveBeenCalled() // doesn't create new thread
  })

  it("creates new thread when not found", () => {
    // First call: find thread (none)
    tryRunGhJsonMock
      .mockReturnValueOnce({
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [],
              },
            },
          },
        },
      })
      // Get head SHA
      .mockReturnValueOnce({ headRefOid: "abc123" })
      // Find thread after create
      .mockReturnValueOnce({
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [{ id: "NEW_THREAD" }],
              },
            },
          },
        },
      })

    tryRunGhMock.mockReturnValue("")

    const result = ensurePrThread("aryeko/ghx-bench-fixtures", 42, "seed-123")

    expect(result).toBe("NEW_THREAD")
    expect(tryRunGhMock).toHaveBeenCalled()
  })

  it("returns empty string when unable to find or create thread", () => {
    // Find thread (none)
    tryRunGhJsonMock
      .mockReturnValueOnce({
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [],
              },
            },
          },
        },
      })
      // Get head SHA (fails)
      .mockReturnValueOnce(null)
      // Find thread after create (none)
      .mockReturnValueOnce({
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [],
              },
            },
          },
        },
      })

    const result = ensurePrThread("aryeko/ghx-bench-fixtures", 42, "seed-123")

    expect(result).toBe("")
  })
})

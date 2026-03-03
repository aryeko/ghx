import { createMixedThreadsSeeder } from "@eval/fixture/seeders/mixed-threads-seeder.js"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@eval/fixture/seeders/gh.js", () => ({
  runGh: vi.fn(),
  runGhWithToken: vi.fn(),
}))

// Import after mock declaration so vi.mocked() picks up the mocked versions
import { runGh, runGhWithToken } from "@eval/fixture/seeders/gh.js"

const mockRunGh = vi.mocked(runGh)
const mockRunGhWithToken = vi.mocked(runGhWithToken)

const REPO = "test-owner/test-repo"
const FIXTURE_NAME = "pr_with_mixed_threads"
const BOT_TOKEN = "bot-token-abc"

const DEFAULT_BRANCH = "main"
const HEAD_SHA_JSON = JSON.stringify({ object: { sha: "abc123def456" } })
const PR_NUMBER = "42"
const SIX_THREADS_JSON = JSON.stringify({
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
          ],
        },
      },
    },
  },
})

function setupHappyPathNoLabels(): void {
  mockRunGh
    .mockResolvedValueOnce(DEFAULT_BRANCH) // getDefaultBranch
    .mockResolvedValueOnce(HEAD_SHA_JSON) // getHeadSha base branch
    .mockResolvedValueOnce("") // createBranch
    .mockRejectedValueOnce(new Error("404 Not Found")) // upsertFile check (file does not exist)
    .mockResolvedValueOnce("") // upsertFile PUT
    .mockResolvedValueOnce(PR_NUMBER) // openPr
    .mockResolvedValueOnce(HEAD_SHA_JSON) // getHeadSha for PR branch
    .mockResolvedValueOnce(SIX_THREADS_JSON) // getThreadIds
  mockRunGhWithToken.mockResolvedValue("")
}

function setupHappyPathWithLabels(): void {
  mockRunGh
    .mockResolvedValueOnce(DEFAULT_BRANCH) // getDefaultBranch
    .mockResolvedValueOnce(HEAD_SHA_JSON) // getHeadSha base branch
    .mockResolvedValueOnce("") // createBranch
    .mockRejectedValueOnce(new Error("404 Not Found")) // upsertFile check (file does not exist)
    .mockResolvedValueOnce("") // upsertFile PUT
    .mockResolvedValueOnce(PR_NUMBER) // openPr
    .mockResolvedValueOnce("") // label assignment
    .mockResolvedValueOnce(HEAD_SHA_JSON) // getHeadSha for PR branch
    .mockResolvedValueOnce(SIX_THREADS_JSON) // getThreadIds
  mockRunGhWithToken.mockResolvedValue("")
}

describe("createMixedThreadsSeeder", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Test 1: returns seeder with type "pr_with_mixed_threads"
  it("returns a seeder with type 'pr_with_mixed_threads'", () => {
    const seeder = createMixedThreadsSeeder()
    expect(seeder.type).toBe("pr_with_mixed_threads")
  })

  // Test 2: throws when botToken not provided
  it("throws when botToken is not provided", async () => {
    const seeder = createMixedThreadsSeeder()
    await expect(
      seeder.seed({ repo: REPO, name: FIXTURE_NAME, labels: [], botToken: undefined }),
    ).rejects.toThrow("mixed-threads seeder requires a bot token")
  })

  // Test 3: seeds PR with 6 comments and resolves first 3 threads (no labels)
  it("seeds PR, posts 6 review comments, and resolves first 3 threads (no labels)", async () => {
    setupHappyPathNoLabels()

    const seeder = createMixedThreadsSeeder()
    const result = await seeder.seed({
      repo: REPO,
      name: FIXTURE_NAME,
      labels: [],
      botToken: BOT_TOKEN,
    })

    expect(result.type).toBe("pr")
    expect(result.number).toBe(42)
    expect(result.repo).toBe(REPO)
    expect(result.labels).toEqual([])

    // 8 runGh calls: getDefaultBranch, getHeadSha(base), createBranch,
    // upsertFile check (rejects), upsertFile PUT, openPr, getHeadSha(branch), getThreadIds
    expect(mockRunGh).toHaveBeenCalledTimes(8)

    // 9 runGhWithToken calls: 6 postReviewComments + 3 resolveThread
    expect(mockRunGhWithToken).toHaveBeenCalledTimes(9)
  })

  // Test 4: includes labels in returned resource (with labels, adds extra runGh call)
  it("includes labels in returned resource and makes extra runGh call for label assignment", async () => {
    setupHappyPathWithLabels()

    const labels = ["@ghx-dev/eval"]
    const seeder = createMixedThreadsSeeder()
    const result = await seeder.seed({
      repo: REPO,
      name: FIXTURE_NAME,
      labels,
      botToken: BOT_TOKEN,
    })

    expect(result.labels).toEqual(labels)

    // 9 runGh calls: same as no-labels path plus 1 extra for label assignment
    expect(mockRunGh).toHaveBeenCalledTimes(9)

    // Verify the label call includes the correct API path
    const allCalls = mockRunGh.mock.calls
    const labelCall = allCalls.find(
      (args) =>
        Array.isArray(args[0]) && args[0].some((a: string) => a.includes(`issues/42/labels`)),
    )
    expect(labelCall).toBeDefined()
  })

  // Test 5: includes originalSha in metadata
  it("includes originalSha in metadata", async () => {
    setupHappyPathNoLabels()

    const seeder = createMixedThreadsSeeder()
    const result = await seeder.seed({
      repo: REPO,
      name: FIXTURE_NAME,
      labels: [],
      botToken: BOT_TOKEN,
    })

    expect(result.metadata).toHaveProperty("originalSha", "abc123def456")
    expect(result.metadata).toHaveProperty("resolvedThreads", 3)
    expect(result.metadata).toHaveProperty("unresolvedThreads", 3)
  })

  // Test 6: branch name matches /^bench-fixture\/{name}-\d+$/
  it("branch name matches expected pattern", async () => {
    setupHappyPathNoLabels()

    const seeder = createMixedThreadsSeeder()
    const result = await seeder.seed({
      repo: REPO,
      name: FIXTURE_NAME,
      labels: [],
      botToken: BOT_TOKEN,
    })

    expect(result.branch).toMatch(new RegExp(`^bench-fixture/${FIXTURE_NAME}-\\d+$`))
  })

  // Test 7: includes existingSha in PUT call when file already exists on branch
  it("includes existingSha in PUT call when file already exists", async () => {
    const existingSha = "existing-sha-789"
    mockRunGh
      .mockResolvedValueOnce(DEFAULT_BRANCH) // getDefaultBranch
      .mockResolvedValueOnce(HEAD_SHA_JSON) // getHeadSha base branch
      .mockResolvedValueOnce("") // createBranch
      .mockResolvedValueOnce(JSON.stringify({ sha: existingSha })) // upsertFile check (file exists)
      .mockResolvedValueOnce("") // upsertFile PUT
      .mockResolvedValueOnce(PR_NUMBER) // openPr
      .mockResolvedValueOnce(HEAD_SHA_JSON) // getHeadSha for PR branch
      .mockResolvedValueOnce(SIX_THREADS_JSON) // getThreadIds
    mockRunGhWithToken.mockResolvedValue("")

    const seeder = createMixedThreadsSeeder()
    await seeder.seed({
      repo: REPO,
      name: FIXTURE_NAME,
      labels: [],
      botToken: BOT_TOKEN,
    })

    // The PUT call (5th runGh call, index 4) should include the existing sha
    const allCalls = mockRunGh.mock.calls
    const putCall = allCalls[4]
    expect(putCall[0]).toContain(`sha=${existingSha}`)
  })

  // Test 8: resolves fewer threads when fewer than 3 threads exist (e.g. 2 threads)
  it("resolves only min(3, threadCount) threads when fewer than 3 threads exist", async () => {
    const twoThreadsJson = JSON.stringify({
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

    mockRunGh
      .mockResolvedValueOnce(DEFAULT_BRANCH) // getDefaultBranch
      .mockResolvedValueOnce(HEAD_SHA_JSON) // getHeadSha base branch
      .mockResolvedValueOnce("") // createBranch
      .mockRejectedValueOnce(new Error("404 Not Found")) // upsertFile check (no file)
      .mockResolvedValueOnce("") // upsertFile PUT
      .mockResolvedValueOnce(PR_NUMBER) // openPr
      .mockResolvedValueOnce(HEAD_SHA_JSON) // getHeadSha for PR branch
      .mockResolvedValueOnce(twoThreadsJson) // getThreadIds (only 2)
    mockRunGhWithToken.mockResolvedValue("")

    const seeder = createMixedThreadsSeeder()
    const result = await seeder.seed({
      repo: REPO,
      name: FIXTURE_NAME,
      labels: [],
      botToken: BOT_TOKEN,
    })

    // 6 comments + 2 resolves = 8 total runGhWithToken calls
    expect(mockRunGhWithToken).toHaveBeenCalledTimes(8)

    expect(result.metadata).toHaveProperty("resolvedThreads", 2)
    expect(result.metadata).toHaveProperty("unresolvedThreads", 0)
  })

  // Test 9: throws when openPr returns non-integer string
  it("throws when openPr returns a non-integer string", async () => {
    mockRunGh
      .mockResolvedValueOnce(DEFAULT_BRANCH) // getDefaultBranch
      .mockResolvedValueOnce(HEAD_SHA_JSON) // getHeadSha base branch
      .mockResolvedValueOnce("") // createBranch
      .mockRejectedValueOnce(new Error("404 Not Found")) // upsertFile check (no file)
      .mockResolvedValueOnce("") // upsertFile PUT
      .mockResolvedValueOnce("not-a-number") // openPr returns bad value

    const seeder = createMixedThreadsSeeder()
    await expect(
      seeder.seed({ repo: REPO, name: FIXTURE_NAME, labels: [], botToken: BOT_TOKEN }),
    ).rejects.toThrow("Failed to create PR")
  })

  // Test 10: rethrows non-404 errors from the file probe with context (Fix 1)
  it("rethrows non-404 errors from the file probe with context", async () => {
    mockRunGh
      .mockResolvedValueOnce(DEFAULT_BRANCH) // getDefaultBranch
      .mockResolvedValueOnce(HEAD_SHA_JSON) // getHeadSha base branch
      .mockResolvedValueOnce("") // createBranch
      .mockRejectedValueOnce(new Error("403 Forbidden")) // upsertFile check (auth error)

    const seeder = createMixedThreadsSeeder()
    await expect(
      seeder.seed({ repo: REPO, name: FIXTURE_NAME, labels: [], botToken: BOT_TOKEN }),
    ).rejects.toThrow("Failed to inspect existing file")
  })

  // Test 11: 404 from the file probe is silently handled (Fix 1)
  it("silently handles a 404 from the file probe and proceeds to create the file", async () => {
    mockRunGh
      .mockResolvedValueOnce(DEFAULT_BRANCH) // getDefaultBranch
      .mockResolvedValueOnce(HEAD_SHA_JSON) // getHeadSha base branch
      .mockResolvedValueOnce("") // createBranch
      .mockRejectedValueOnce(new Error("404 Not Found")) // upsertFile check (file does not exist)
      .mockResolvedValueOnce("") // upsertFile PUT
      .mockResolvedValueOnce(PR_NUMBER) // openPr
      .mockResolvedValueOnce(HEAD_SHA_JSON) // getHeadSha for PR branch
      .mockResolvedValueOnce(SIX_THREADS_JSON) // getThreadIds
    mockRunGhWithToken.mockResolvedValue("")

    const seeder = createMixedThreadsSeeder()
    const result = await seeder.seed({
      repo: REPO,
      name: FIXTURE_NAME,
      labels: [],
      botToken: BOT_TOKEN,
    })

    expect(result.type).toBe("pr")
    // PUT call (index 4) should NOT contain a sha field since the file was new
    const putCall = mockRunGh.mock.calls[4]
    expect(putCall[0]).not.toContain("sha=")
  })

  // Test 12: openPr uses the resolved defaultBranch as base (Fix 2)
  it("passes the resolved defaultBranch to openPr as the base branch", async () => {
    const customDefault = "develop"
    mockRunGh
      .mockResolvedValueOnce(customDefault) // getDefaultBranch returns "develop"
      .mockResolvedValueOnce(HEAD_SHA_JSON) // getHeadSha base branch
      .mockResolvedValueOnce("") // createBranch
      .mockRejectedValueOnce(new Error("404 Not Found")) // upsertFile check (file does not exist)
      .mockResolvedValueOnce("") // upsertFile PUT
      .mockResolvedValueOnce(PR_NUMBER) // openPr
      .mockResolvedValueOnce(HEAD_SHA_JSON) // getHeadSha for PR branch
      .mockResolvedValueOnce(SIX_THREADS_JSON) // getThreadIds
    mockRunGhWithToken.mockResolvedValue("")

    const seeder = createMixedThreadsSeeder()
    await seeder.seed({
      repo: REPO,
      name: FIXTURE_NAME,
      labels: [],
      botToken: BOT_TOKEN,
    })

    // The openPr call (6th runGh call, index 5) should use base=develop
    const allCalls = mockRunGh.mock.calls
    const prCall = allCalls[5]
    expect(prCall[0]).toContain(`base=${customDefault}`)
    expect(prCall[0]).not.toContain("base=main")
  })
})

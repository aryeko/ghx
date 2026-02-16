import { beforeEach, describe, expect, it, vi } from "vitest"

const spawnSyncMock = vi.hoisted(() => vi.fn())

vi.mock("node:child_process", () => ({
  spawnSync: spawnSyncMock,
}))

import { cleanupSeededFixtures } from "../../src/fixture/cleanup.js"

describe("fixture cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("closes open seeded issues by bench labels", async () => {
    spawnSyncMock
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([{ number: 12 }]),
        stderr: "",
      })
      .mockReturnValueOnce({
        status: 0,
        stdout: "",
        stderr: "",
      })

    const result = await cleanupSeededFixtures({
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main",
      },
      resources: {
        metadata: {
          seed_id: "local",
        },
      },
    })

    expect(result.closedIssues).toBe(1)
    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      "gh",
      [
        "issue",
        "list",
        "--repo",
        "aryeko/ghx-bench-fixtures",
        "--state",
        "open",
        "--label",
        "bench-fixture",
        "--label",
        "bench-seed:local",
        "--limit",
        "200",
        "--json",
        "number",
      ],
      { encoding: "utf8" },
    )
  })

  it("uses default seed label when metadata seed id is missing or invalid", async () => {
    spawnSyncMock.mockReturnValue({
      status: 0,
      stdout: JSON.stringify([{ number: 15 }]),
      stderr: "",
    })

    await cleanupSeededFixtures({
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main",
      },
      resources: {
        metadata: [],
      },
    })

    expect(spawnSyncMock).toHaveBeenNthCalledWith(
      1,
      "gh",
      expect.arrayContaining(["bench-seed:default"]),
      { encoding: "utf8" },
    )
  })

  it("ignores non-array issue responses and malformed issue rows", async () => {
    spawnSyncMock
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify({ items: [{ number: 1 }] }),
        stderr: "",
      })
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([null, { number: "not-number" }, { number: 7 }]),
        stderr: "",
      })
      .mockReturnValueOnce({
        status: 0,
        stdout: "",
        stderr: "",
      })

    const first = await cleanupSeededFixtures({
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main",
      },
      resources: {
        metadata: { seed_id: "local" },
      },
    })

    const second = await cleanupSeededFixtures({
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main",
      },
      resources: {
        metadata: { seed_id: "local" },
      },
    })

    expect(first.closedIssues).toBe(0)
    expect(second.closedIssues).toBe(1)
  })

  it("throws helpful fallback error when gh command fails without stderr", async () => {
    spawnSyncMock.mockReturnValue({
      status: 1,
      stdout: "",
      stderr: "",
    })

    await expect(
      cleanupSeededFixtures({
        version: 1,
        repo: {
          owner: "aryeko",
          name: "ghx-bench-fixtures",
          full_name: "aryeko/ghx-bench-fixtures",
          default_branch: "main",
        },
        resources: {
          metadata: {
            seed_id: "local",
          },
        },
      }),
    ).rejects.toThrow("gh command failed: gh issue list --repo aryeko/ghx-bench-fixtures")
  })
})

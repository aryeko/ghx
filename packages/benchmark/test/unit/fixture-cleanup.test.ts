import { describe, expect, it, vi } from "vitest"

const spawnSyncMock = vi.hoisted(() => vi.fn())

vi.mock("node:child_process", () => ({
  spawnSync: spawnSyncMock
}))

import { cleanupSeededFixtures } from "../../src/fixture/cleanup.js"

describe("fixture cleanup", () => {
  it("closes open seeded issues by bench labels", async () => {
    spawnSyncMock
      .mockReturnValueOnce({
        status: 0,
        stdout: JSON.stringify([{ number: 12 }]),
        stderr: ""
      })
      .mockReturnValueOnce({
        status: 0,
        stdout: "",
        stderr: ""
      })

    const result = await cleanupSeededFixtures({
      version: 1,
      repo: {
        owner: "aryeko",
        name: "ghx-bench-fixtures",
        full_name: "aryeko/ghx-bench-fixtures",
        default_branch: "main"
      },
      resources: {
        metadata: {
          seed_id: "local"
        }
      }
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
        "number"
      ],
      { encoding: "utf8" }
    )
  })
})

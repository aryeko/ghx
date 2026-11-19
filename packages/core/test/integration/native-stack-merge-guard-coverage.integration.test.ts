import { executeTask } from "@core/core/routing/engine/index.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"

const request = {
  task: "pr.merge",
  input: { owner: "acme", name: "repo", prNumber: 5 },
}

describe("merge membership verification boundaries", () => {
  it.each([
    {},
    { url: "http://github.com/acme/repo/pull/5" },
    { url: "https://user@github.com/acme/repo/pull/5" },
    { url: "https://user:private@github.com/acme/repo/pull/5" },
    { url: "https://github.com:444/acme/repo/pull/5" },
  ])("rejects an unverified PR identity before dispatch (%#)", async (pr) => {
    const queryRaw = vi.fn().mockResolvedValue({
      data: { repository: { pullRequest: { stack: null, ...pr } } },
    })
    const mergePr = vi.fn()
    const run = vi.fn()
    const result = await executeTask(request, {
      githubClient: createGithubClient({ queryRaw, mergePr }),
      cliRunner: { run },
      skipGhPreflight: true,
    })

    expect(result.error).toMatchObject({
      retryable: false,
      message: "Unable to verify pull request stack membership with the selected merge route",
    })
    expect(JSON.stringify(result)).not.toContain("private")
    expect(mergePr).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it("refuses a CLI merge after an unauthenticated membership read with no JSON", async () => {
    const run = vi.fn().mockResolvedValue({
      exitCode: 1,
      stdout: "",
      stderr: "Bad credentials: private credential text",
    })
    const mergePr = vi.fn()
    const result = await executeTask(
      { ...request, input: { ...request.input, deleteBranch: true } },
      {
        githubClient: createGithubClient({ mergePr }),
        cliRunner: { run },
        skipGhPreflight: true,
      },
    )

    expect(result.error).toMatchObject({
      message: "Unable to verify pull request stack membership with the selected merge route",
      retryable: false,
    })
    expect(run).toHaveBeenCalledExactlyOnceWith(
      "gh",
      expect.arrayContaining(["api", "graphql"]),
      expect.any(Number),
    )
    expect(JSON.stringify(result)).not.toContain("private credential text")
    expect(mergePr).not.toHaveBeenCalled()
  })

  it("keeps hosted data-residency accounts fail-closed when the schema is incomplete", async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        errors: [{ message: "Field 'stack' doesn't exist on type 'PullRequest'" }],
      })
      .mockResolvedValueOnce({
        data: { repository: { pullRequest: { url: "https://tenant.ghe.com/acme/repo/pull/5" } } },
      })
    const mergePr = vi.fn()
    const result = await executeTask(request, {
      githubClient: createGithubClient({ queryRaw, mergePr }),
      skipGhPreflight: true,
    })

    expect(queryRaw).toHaveBeenCalledTimes(2)
    expect(result.error?.retryable).toBe(false)
    expect(result.error?.message).toContain("Unable to verify")
    expect(mergePr).not.toHaveBeenCalled()
  })
})

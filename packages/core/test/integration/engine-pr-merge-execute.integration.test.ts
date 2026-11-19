import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine/index.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"
import { cliMembershipResponse, membershipResponse } from "../helpers/pr-merge-fixtures.js"

const prUrl = "https://github.com/acme/repo/pull/5"
const request: TaskRequest = {
  task: "pr.merge",
  input: { owner: "acme", name: "repo", prNumber: 5 },
}

describe("executeTask pr.merge", () => {
  it("uses the provided GraphQL client's identity and stops before merging a known stack member", async () => {
    const queryRaw = vi.fn().mockResolvedValue(membershipResponse(prUrl, { number: 42 }))
    const mergePr = vi.fn()
    const run = vi.fn()
    const result = await executeTask(request, {
      githubClient: createGithubClient({ queryRaw, mergePr }),
      cliRunner: { run },
    })
    expect(queryRaw).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining("stack { number }"),
      request.input,
    )
    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION", retryable: false, details: { stackNumber: 42, prNumber: 5 } },
      meta: { route_used: "graphql" },
    })
    expect(result.error?.message).toContain("pr.stack.merge")
    expect(mergePr).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it.each([
    {
      data: undefined,
      errors: [{ message: "operation not available with credential secret-value" }],
    },
    { data: { repository: { pullRequest: { url: prUrl } } }, errors: undefined },
    { ...membershipResponse(prUrl), errors: [{ message: "403 Forbidden" }] },
    membershipResponse("https://github.com/acme/elsewhere/pull/5"),
  ])("blocks GraphQL and fallback on an inconclusive membership read %#", async (response) => {
    const mergePr = vi.fn()
    const run = vi.fn()
    const result = await executeTask(request, {
      githubClient: createGithubClient({ queryRaw: vi.fn().mockResolvedValue(response), mergePr }),
      cliRunner: { run },
      skipGhPreflight: true,
    })
    expect(result.error).toMatchObject({
      retryable: false,
      message: expect.stringContaining("Unable to verify"),
    })
    expect(result.error?.message).not.toContain("secret-value")
    expect(mergePr).not.toHaveBeenCalled()
    expect(run).not.toHaveBeenCalled()
  })

  it("checks CLI membership again when the GraphQL merge is unsupported", async () => {
    const queryRaw = vi.fn().mockResolvedValue(membershipResponse(prUrl))
    const mergePr = vi.fn().mockRejectedValue(new Error("merge operation not available"))
    const run = vi.fn().mockResolvedValue(cliMembershipResponse(prUrl, { number: 7 }))
    const result = await executeTask(request, {
      githubClient: createGithubClient({ queryRaw, mergePr }),
      cliRunner: { run },
      skipGhPreflight: true,
    })
    expect(mergePr).toHaveBeenCalledOnce()
    expect(run).toHaveBeenCalledExactlyOnceWith(
      "gh",
      expect.arrayContaining(["api", "graphql", "owner=acme", "name=repo", "prNumber=5"]),
      expect.any(Number),
    )
    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION", retryable: false, details: { stackNumber: 7 } },
      meta: { route_used: "cli" },
    })
  })

  it("fails closed if hosted GitHub does not expose the stack field", async () => {
    const queryRaw = vi.fn()
    const mergePr = vi.fn()
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 1,
        stderr: "GraphQL error",
        stdout: JSON.stringify({
          errors: [{ message: "Field 'stack' doesn't exist on type 'PullRequest'" }],
        }),
      })
      .mockResolvedValueOnce(cliMembershipResponse(prUrl))
    const result = await executeTask(
      { ...request, input: { ...request.input, auto: true } },
      {
        githubClient: createGithubClient({ queryRaw, mergePr }),
        cliRunner: { run },
        skipGhPreflight: true,
      },
    )
    expect(result.error).toMatchObject({
      retryable: false,
      message: expect.stringContaining("Unable to verify"),
    })
    expect(run).toHaveBeenCalledTimes(2)
    expect(queryRaw).not.toHaveBeenCalled()
    expect(mergePr).not.toHaveBeenCalled()
  })

  it("preserves the CLI merge on a verified Enterprise Server without native stack fields", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 1,
        stderr: "GraphQL error",
        stdout: JSON.stringify({
          errors: [{ message: "Field 'stack' doesn't exist on type 'PullRequest'" }],
        }),
      })
      .mockResolvedValueOnce(cliMembershipResponse("https://git.example.org/acme/repo/pull/5"))
      .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
    const result = await executeTask(
      { ...request, input: { ...request.input, deleteBranch: true } },
      { githubClient: createGithubClient(), cliRunner: { run }, skipGhPreflight: true },
    )
    expect(result).toMatchObject({ ok: true, data: { prNumber: 5, deleteBranch: true } })
    expect(run).toHaveBeenLastCalledWith(
      "gh",
      ["pr", "merge", "5", "--repo", "git.example.org/acme/repo", "--merge", "--delete-branch"],
      10_000,
    )
  })

  it("returns graphql envelope for pr.merge", async () => {
    const githubClient = {
      queryRaw: async () => membershipResponse("https://github.com/go-modkit/modkit/pull/232"),
      mergePr: async () => ({
        prNumber: 232,
        method: "merge",
        isMethodAssumed: true,
        queued: false,
        deleteBranch: false,
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "pr.merge",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toMatchObject({
      prNumber: 232,
      method: "merge",
      queued: false,
      deleteBranch: false,
    })
  })

  it("returns validation error envelope for invalid prNumber", async () => {
    const githubClient = {
      mergePr: async () => ({
        prNumber: 0,
        method: "merge",
        queued: false,
        deleteBranch: false,
      }),
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "pr.merge",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 0,
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.meta.reason).toBe("INPUT_VALIDATION")
  })

  it("falls back to CLI when deleteBranch is present", async () => {
    const githubClient = {
      mergePr: async (): Promise<never> => {
        throw new Error("mergePr should not be called when deleteBranch is in input")
      },
    } as unknown as GithubClient

    const request: TaskRequest = {
      task: "pr.merge",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        deleteBranch: true,
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    // GQL route throws AdapterUnsupported for deleteBranch → CLI unavailable → final error
    expect(result.ok).toBe(false)
    expect(result.error?.code).not.toBe("VALIDATION")
  })
})

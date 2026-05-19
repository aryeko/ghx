import { executeTasks } from "@core/core/routing/engine/index.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"

// These tests exercise the real card registry, real document registry, real batch
// builder, and real resolve.ts. Only the GraphQL transport is mocked so we can
// inspect the variables sent by the chain executor.
//
// Regression target: chained `ghx chain` of `pr.merge` steps must resolve
// `pullRequestId` from `prNumber` and normalize the lowercase `method` input to
// the uppercase `mergeMethod` GraphQL enum. The single-call path goes through
// the per-domain `runPrMerge` handler which resolves the id itself; the chain
// path relies on the card's `graphql.resolution` block.

describe("executeTasks chaining — pr.merge resolution (issue #4)", () => {
  it("routes deleteBranch closes in a chain through the CLI route", async () => {
    const queryMock = vi.fn()
    const queryRawMock = vi.fn()
    const cliRunner = {
      run: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" }),
    }

    const result = await executeTasks(
      [
        {
          task: "pr.close",
          input: { owner: "acme", name: "repo", prNumber: 1, deleteBranch: true },
        },
        {
          task: "pr.close",
          input: { owner: "acme", name: "repo", prNumber: 2, deleteBranch: true },
        },
      ],
      {
        githubClient: createGithubClient({
          query: queryMock,
          queryRaw: queryRawMock,
        }),
        cliRunner,
        skipGhPreflight: true,
      },
    )

    expect(result.status).toBe("success")
    expect(queryMock).not.toHaveBeenCalled()
    expect(queryRawMock).not.toHaveBeenCalled()
    expect(cliRunner.run).toHaveBeenCalledTimes(2)
    expect(cliRunner.run).toHaveBeenNthCalledWith(
      1,
      "gh",
      expect.arrayContaining(["pr", "close", "1", "--delete-branch"]),
      expect.any(Number),
    )
    expect(cliRunner.run).toHaveBeenNthCalledWith(
      2,
      "gh",
      expect.arrayContaining(["pr", "close", "2", "--delete-branch"]),
      expect.any(Number),
    )
  })

  it("routes admin merges in a chain through the CLI route", async () => {
    const queryMock = vi.fn()
    const queryRawMock = vi.fn()
    const cliRunner = {
      run: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" }),
    }

    const result = await executeTasks(
      [
        {
          task: "pr.merge",
          input: { owner: "acme", name: "repo", prNumber: 1, admin: true },
        },
        {
          task: "pr.merge",
          input: { owner: "acme", name: "repo", prNumber: 2, auto: true },
        },
      ],
      {
        githubClient: createGithubClient({
          query: queryMock,
          queryRaw: queryRawMock,
        }),
        cliRunner,
        skipGhPreflight: true,
      },
    )

    expect(result.status).toBe("success")
    expect(queryMock).not.toHaveBeenCalled()
    expect(queryRawMock).not.toHaveBeenCalled()
    expect(cliRunner.run).toHaveBeenCalledTimes(2)
    expect(cliRunner.run).toHaveBeenNthCalledWith(
      1,
      "gh",
      expect.arrayContaining(["pr", "merge", "1", "--merge", "--admin"]),
      expect.any(Number),
    )
    expect(cliRunner.run).toHaveBeenNthCalledWith(
      2,
      "gh",
      expect.arrayContaining(["pr", "merge", "2", "--merge", "--auto"]),
      expect.any(Number),
    )
  })

  it("routes deleteBranch merges in a chain through the CLI route", async () => {
    const queryMock = vi.fn()
    const queryRawMock = vi.fn()
    const cliRunner = {
      run: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" }),
    }

    const result = await executeTasks(
      [
        {
          task: "pr.merge",
          input: { owner: "acme", name: "repo", prNumber: 1, method: "squash", deleteBranch: true },
        },
        {
          task: "pr.merge",
          input: { owner: "acme", name: "repo", prNumber: 2, method: "rebase", deleteBranch: true },
        },
      ],
      {
        githubClient: createGithubClient({
          query: queryMock,
          queryRaw: queryRawMock,
        }),
        cliRunner,
        skipGhPreflight: true,
      },
    )

    expect(result.status).toBe("success")
    expect(queryMock).not.toHaveBeenCalled()
    expect(queryRawMock).not.toHaveBeenCalled()
    expect(cliRunner.run).toHaveBeenCalledTimes(2)
    expect(cliRunner.run).toHaveBeenNthCalledWith(
      1,
      "gh",
      expect.arrayContaining(["pr", "merge", "1", "--squash", "--delete-branch"]),
      expect.any(Number),
    )
    expect(cliRunner.run).toHaveBeenNthCalledWith(
      2,
      "gh",
      expect.arrayContaining(["pr", "merge", "2", "--rebase", "--delete-branch"]),
      expect.any(Number),
    )
  })

  it("resolves pullRequestId and uppercases mergeMethod for a 2-step pr.merge chain", async () => {
    // Phase 1 (resolution lookup): batched PrNodeId query returns one node per step alias.
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: { pullRequest: { id: "PR_NODE_0" } },
      step1: { pullRequest: { id: "PR_NODE_1" } },
    })

    // Phase 2 (batched mutation): captures the raw mutation variables sent to GitHub.
    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: {
          mergePullRequest: {
            pullRequest: {
              id: "PR_NODE_0",
              number: 1,
              state: "MERGED",
              merged: true,
              mergedAt: "2026-05-19T00:00:00Z",
            },
          },
        },
        step1: {
          mergePullRequest: {
            pullRequest: {
              id: "PR_NODE_1",
              number: 2,
              state: "MERGED",
              merged: true,
              mergedAt: "2026-05-19T00:00:00Z",
            },
          },
        },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        {
          task: "pr.merge",
          input: { owner: "acme", name: "repo", prNumber: 1, method: "squash" },
        },
        {
          task: "pr.merge",
          input: { owner: "acme", name: "repo", prNumber: 2, method: "squash" },
        },
      ],
      {
        githubClient: createGithubClient({
          query: queryMock,
          queryRaw: queryRawMock,
        }),
      },
    )

    // Phase 1: batched PrNodeId lookup was issued.
    expect(queryMock).toHaveBeenCalledTimes(1)
    const lookupArgs = queryMock.mock.calls[0]
    expect(lookupArgs?.[0]).toContain("step0")
    expect(lookupArgs?.[0]).toContain("step1")
    const lookupVars = lookupArgs?.[1] as Record<string, unknown>
    expect(lookupVars.step0_owner).toBe("acme")
    expect(lookupVars.step0_name).toBe("repo")
    expect(lookupVars.step0_prNumber).toBe(1)
    expect(lookupVars.step1_owner).toBe("acme")
    expect(lookupVars.step1_name).toBe("repo")
    expect(lookupVars.step1_prNumber).toBe(2)

    // Phase 2: batched PrMerge mutation has the resolved pullRequestId per step
    // and the uppercase mergeMethod derived from the lowercase user input.
    expect(queryRawMock).toHaveBeenCalledTimes(1)
    const mutationArgs = queryRawMock.mock.calls[0]
    const mutationVars = mutationArgs?.[1] as Record<string, unknown>
    expect(mutationVars.step0_pullRequestId).toBe("PR_NODE_0")
    expect(mutationVars.step0_mergeMethod).toBe("SQUASH")
    expect(mutationVars.step1_pullRequestId).toBe("PR_NODE_1")
    expect(mutationVars.step1_mergeMethod).toBe("SQUASH")

    expect(result.status).toBe("success")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toMatchObject({ task: "pr.merge", ok: true })
    expect(result.results[1]).toMatchObject({ task: "pr.merge", ok: true })
  })

  it("omits mergeMethod from mutation variables when `method` input is not provided", async () => {
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: { pullRequest: { id: "PR_NODE_0" } },
      step1: { pullRequest: { id: "PR_NODE_1" } },
    })

    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: {
          mergePullRequest: {
            pullRequest: {
              id: "PR_NODE_0",
              number: 1,
              state: "MERGED",
              merged: true,
              mergedAt: "2026-05-19T00:00:00Z",
            },
          },
        },
        step1: {
          mergePullRequest: {
            pullRequest: {
              id: "PR_NODE_1",
              number: 2,
              state: "MERGED",
              merged: true,
              mergedAt: "2026-05-19T00:00:00Z",
            },
          },
        },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        {
          task: "pr.merge",
          input: { owner: "acme", name: "repo", prNumber: 1 },
        },
        {
          task: "pr.merge",
          input: { owner: "acme", name: "repo", prNumber: 2 },
        },
      ],
      {
        githubClient: createGithubClient({
          query: queryMock,
          queryRaw: queryRawMock,
        }),
      },
    )

    expect(queryRawMock).toHaveBeenCalledTimes(1)
    const mutationVars = queryRawMock.mock.calls[0]?.[1] as Record<string, unknown>

    // pullRequestId is still resolved from prNumber.
    expect(mutationVars.step0_pullRequestId).toBe("PR_NODE_0")
    expect(mutationVars.step1_pullRequestId).toBe("PR_NODE_1")

    // mergeMethod is absent because `input_upper` returns {} when the source field is missing,
    // and the PrMerge mutation declares $mergeMethod as optional.
    expect(mutationVars).not.toHaveProperty("step0_mergeMethod")
    expect(mutationVars).not.toHaveProperty("step1_mergeMethod")

    expect(result.status).toBe("success")
  })

  it('normalizes lowercase `method: "squash"` to uppercase `mergeMethod: "SQUASH"`', async () => {
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: { pullRequest: { id: "PR_NODE_0" } },
      step1: { pullRequest: { id: "PR_NODE_1" } },
    })

    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: {
          mergePullRequest: {
            pullRequest: {
              id: "PR_NODE_0",
              number: 7,
              state: "MERGED",
              merged: true,
              mergedAt: "2026-05-19T00:00:00Z",
            },
          },
        },
        step1: {
          mergePullRequest: {
            pullRequest: {
              id: "PR_NODE_1",
              number: 8,
              state: "MERGED",
              merged: true,
              mergedAt: "2026-05-19T00:00:00Z",
            },
          },
        },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        {
          task: "pr.merge",
          input: { owner: "acme", name: "repo", prNumber: 7, method: "squash" },
        },
        {
          task: "pr.merge",
          input: { owner: "acme", name: "repo", prNumber: 8, method: "rebase" },
        },
      ],
      {
        githubClient: createGithubClient({
          query: queryMock,
          queryRaw: queryRawMock,
        }),
      },
    )

    const mutationVars = queryRawMock.mock.calls[0]?.[1] as Record<string, unknown>
    expect(mutationVars.step0_mergeMethod).toBe("SQUASH")
    expect(mutationVars.step1_mergeMethod).toBe("REBASE")
    expect(result.status).toBe("success")
  })
})

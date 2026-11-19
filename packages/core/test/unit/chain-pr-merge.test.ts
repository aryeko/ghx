import { executeTasks } from "@core/core/routing/engine/index.js"
import { createGithubClient as createTransportClient } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"
import { cliMembershipResponse, membershipResponse } from "../helpers/pr-merge-fixtures.js"

describe("executeTasks chaining — guarded pr.merge", () => {
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

  it("guards independently dispatched GraphQL steps and preserves merge normalization", async () => {
    const transportCall = vi.fn((query: string, params?: Record<string, unknown>) => {
      const prNumber = Number(params?.prNumber)
      if (query.includes("query PrMergeMembership")) {
        const stack = prNumber === 4 ? { number: 17 } : null
        return membershipResponse(`https://github.com/acme/repo/pull/${prNumber}`, stack).data
      }
      if (query.includes("query PrNodeId")) {
        return { repository: { pullRequest: { id: `PR_${prNumber}` } } }
      }
      if (query.includes("mutation PrMerge")) {
        return { mergePullRequest: { pullRequest: { id: params?.pullRequestId } } }
      }
      throw new Error(`Unexpected operation: ${query}`)
    })
    const githubClient = createTransportClient({
      async execute<TData>(query: string, params?: Record<string, unknown>) {
        return transportCall(query, params) as TData
      },
    })
    const result = await executeTasks(
      [
        { task: "pr.merge", input: { owner: "acme", name: "repo", prNumber: 1, method: "squash" } },
        { task: "pr.merge", input: { owner: "acme", name: "repo", prNumber: 4 } },
        { task: "pr.merge", input: { owner: "acme", name: "repo", prNumber: 2, method: "rebase" } },
        { task: "pr.merge", input: { owner: "acme", name: "repo", prNumber: 3 } },
      ],
      { githubClient, githubToken: "different-token" },
    )
    expect(result.status).toBe("partial")
    expect(result.results).toMatchObject([
      { ok: true, data: { prNumber: 1, method: "squash", isMethodAssumed: false } },
      { ok: false, error: { code: "VALIDATION", retryable: false, details: { stackNumber: 17 } } },
      { ok: true, data: { prNumber: 2, method: "rebase", isMethodAssumed: false } },
      { ok: true, data: { prNumber: 3, method: "merge", isMethodAssumed: true } },
    ])
    const calls = transportCall.mock.calls
    expect(
      calls.filter(([query]) => query.includes("mutation PrMerge")).map(([, vars]) => vars),
    ).toEqual([
      { pullRequestId: "PR_1", mergeMethod: "SQUASH" },
      { pullRequestId: "PR_2", mergeMethod: "REBASE" },
      { pullRequestId: "PR_3" },
    ])
    expect(
      calls.some(([query, vars]) => query.includes("query PrNodeId") && vars?.prNumber === 4),
    ).toBe(false)
  })

  it("checks flags through the CLI's own transport before any CLI merge", async () => {
    const queryRaw = vi.fn()
    const run = vi.fn(async (_command: string, args: string[]) => {
      if (args[0] === "api" && args[1] === "graphql") {
        const pr = args.at(-1)?.split("=")[1]
        const stack = pr === "4" ? null : { number: 19 }
        return cliMembershipResponse(`https://github.com/acme/repo/pull/${pr}`, stack)
      }
      return { exitCode: 0, stdout: "", stderr: "" }
    })
    const result = await executeTasks(
      [
        { task: "pr.merge", input: { owner: "acme", name: "repo", prNumber: 1, admin: true } },
        { task: "pr.merge", input: { owner: "acme", name: "repo", prNumber: 2, auto: true } },
        {
          task: "pr.merge",
          input: { owner: "acme", name: "repo", prNumber: 3, deleteBranch: true },
        },
        {
          task: "pr.merge",
          input: { owner: "acme", name: "repo", prNumber: 4, deleteBranch: true },
        },
      ],
      { githubClient: createGithubClient({ queryRaw }), cliRunner: { run }, skipGhPreflight: true },
    )
    expect(result.status).toBe("partial")
    expect(result.meta.route_used).toBe("cli")
    expect(result.results.slice(0, 3)).toMatchObject(
      Array.from({ length: 3 }, () => ({
        ok: false,
        error: { code: "VALIDATION", retryable: false, details: { stackNumber: 19 } },
      })),
    )
    expect(result.results[3]).toMatchObject({ ok: true, data: { prNumber: 4, deleteBranch: true } })
    expect(queryRaw).not.toHaveBeenCalled()
    expect(run.mock.calls.filter(([, args]) => args[0] === "pr")).toEqual([
      [
        "gh",
        ["pr", "merge", "4", "--repo", "github.com/acme/repo", "--merge", "--delete-branch"],
        10_000,
      ],
    ])
  })
})

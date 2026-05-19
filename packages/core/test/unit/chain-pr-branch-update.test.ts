import { executeTasks } from "@core/core/routing/engine/index.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"

// These tests exercise the real card registry, real document registry, real batch
// builder, and real resolve.ts. Only the GraphQL transport is mocked so we can
// inspect the variables sent by the chain executor.
//
// Regression target: chained `ghx chain` of `pr.branch.update` steps must resolve
// `pullRequestId` from `prNumber`. The single-call path goes through
// the per-domain `runPrBranchUpdate` handler which resolves the id itself; the chain
// path relies on the card's `graphql.resolution` block.

describe("executeTasks chaining — pr.branch.update resolution (issue #4)", () => {
  it("resolves pullRequestId for a 2-step pr.branch.update chain", async () => {
    // Phase 1 (resolution lookup): batched PrNodeId query returns one node per step alias.
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: { pullRequest: { id: "PR_NODE_0" } },
      step1: { pullRequest: { id: "PR_NODE_1" } },
    })

    // Phase 2 (batched mutation): captures the raw mutation variables sent to GitHub.
    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: {
          updatePullRequestBranch: {
            pullRequest: {
              id: "PR_NODE_0",
              number: 1,
            },
          },
        },
        step1: {
          updatePullRequestBranch: {
            pullRequest: {
              id: "PR_NODE_1",
              number: 2,
            },
          },
        },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        {
          task: "pr.branch.update",
          input: { owner: "acme", name: "repo", prNumber: 1 },
        },
        {
          task: "pr.branch.update",
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

    // Phase 2: batched PrBranchUpdate mutation has the resolved pullRequestId per step.
    expect(queryRawMock).toHaveBeenCalledTimes(1)
    const mutationArgs = queryRawMock.mock.calls[0]
    const mutationVars = mutationArgs?.[1] as Record<string, unknown>
    expect(mutationVars.step0_pullRequestId).toBe("PR_NODE_0")
    expect(mutationVars.step1_pullRequestId).toBe("PR_NODE_1")

    expect(result.status).toBe("success")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toMatchObject({
      task: "pr.branch.update",
      ok: true,
    })
    expect(result.results[1]).toMatchObject({
      task: "pr.branch.update",
      ok: true,
    })
  })
})

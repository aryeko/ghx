import { executeTasks } from "@core/core/routing/engine/index.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"

// These tests exercise the real card registry, real document registry, real batch
// builder, and real resolve.ts. Only the GraphQL transport is mocked so we can
// inspect the variables sent by the chain executor.
//
// Regression target: chained `ghx chain` of `pr.assignees.remove` steps must resolve
// `assignableId` from `prNumber` and translate user logins to user node IDs.
// The chain path relies on the card's `graphql.resolution` block.

describe("executeTasks chaining — pr.assignees.remove resolution", () => {
  it("resolves assignableId and assigneeIds for a 2-step pr.assignees.remove chain", async () => {
    // Phase 1 (resolution lookup): batched PrAssigneesLookupByNumber query returns
    // one node per step alias with pullRequest id and assignableUsers.
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: {
        pullRequest: { id: "PR_NODE_0" },
        assignableUsers: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            { login: "alice", id: "U_alice" },
            { login: "bob", id: "U_bob" },
          ],
        },
      },
      step1: {
        pullRequest: { id: "PR_NODE_1" },
        assignableUsers: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            { login: "charlie", id: "U_charlie" },
            { login: "dave", id: "U_dave" },
          ],
        },
      },
    })

    // Phase 2 (batched mutation): captures the raw mutation variables sent to GitHub.
    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: {
          removeAssigneesFromAssignable: {
            assignable: {
              assignees: {
                nodes: [{ login: "bob" }],
              },
            },
          },
        },
        step1: {
          removeAssigneesFromAssignable: {
            assignable: {
              assignees: {
                nodes: [{ login: "dave" }],
              },
            },
          },
        },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        {
          task: "pr.assignees.remove",
          input: {
            owner: "acme",
            name: "repo",
            prNumber: 1,
            assignees: ["alice"],
          },
        },
        {
          task: "pr.assignees.remove",
          input: {
            owner: "acme",
            name: "repo",
            prNumber: 2,
            assignees: ["charlie"],
          },
        },
      ],
      {
        githubClient: createGithubClient({
          query: queryMock,
          queryRaw: queryRawMock,
        }),
      },
    )

    // Phase 1: batched PrAssigneesLookupByNumber lookup was issued.
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

    // Phase 2: batched PrAssigneesRemove mutation has the resolved assignableId
    // and assigneeIds (translated from logins).
    expect(queryRawMock).toHaveBeenCalledTimes(1)
    const mutationArgs = queryRawMock.mock.calls[0]
    const mutationVars = mutationArgs?.[1] as Record<string, unknown>
    expect(mutationVars.step0_assignableId).toBe("PR_NODE_0")
    expect(mutationVars.step0_assigneeIds).toEqual(["U_alice"])
    expect(mutationVars.step1_assignableId).toBe("PR_NODE_1")
    expect(mutationVars.step1_assigneeIds).toEqual(["U_charlie"])

    expect(result.status).toBe("success")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toMatchObject({
      task: "pr.assignees.remove",
      ok: true,
    })
    expect(result.results[1]).toMatchObject({
      task: "pr.assignees.remove",
      ok: true,
    })
  })
})

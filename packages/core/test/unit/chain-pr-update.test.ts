import { executeTasks } from "@core/core/routing/engine/index.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"

// These tests exercise the real card registry, real document registry, real batch
// builder, and real resolve.ts. Only the GraphQL transport is mocked so we can
// inspect the variables sent by the chain executor.
//
// Regression target: chained `ghx chain` of `pr.update` steps must resolve
// `pullRequestId` from `prNumber`. The single-call path goes through
// the per-domain `runPrUpdate` handler which resolves the id itself; the chain
// path relies on the card's `graphql.resolution` block.

describe("executeTasks chaining — pr.update resolution (issue #4)", () => {
  it("routes explicit draft updates in a chain through the CLI route", async () => {
    const queryMock = vi.fn()
    const queryRawMock = vi.fn()
    const cliRunner = {
      run: vi.fn().mockResolvedValue({ exitCode: 0, stdout: "", stderr: "" }),
    }

    const result = await executeTasks(
      [
        {
          task: "pr.update",
          input: { owner: "acme", name: "repo", prNumber: 1, draft: true },
        },
        {
          task: "pr.update",
          input: { owner: "acme", name: "repo", prNumber: 2, draft: false },
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
      expect.arrayContaining(["pr", "ready", "1", "--undo"]),
      expect.any(Number),
    )
    expect(cliRunner.run).toHaveBeenNthCalledWith(
      2,
      "gh",
      expect.arrayContaining(["pr", "ready", "2"]),
      expect.any(Number),
    )
  })

  it("resolves pullRequestId for a 2-step pr.update chain", async () => {
    // Phase 1 (resolution lookup): batched PrNodeId query returns one node per step alias.
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: { pullRequest: { id: "PR_NODE_0" } },
      step1: { pullRequest: { id: "PR_NODE_1" } },
    })

    // Phase 2 (batched mutation): captures the raw mutation variables sent to GitHub.
    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: {
          updatePullRequest: {
            pullRequest: {
              id: "PR_NODE_0",
              number: 1,
              title: "Updated title 1",
              body: "Updated body 1",
              state: "OPEN",
              isDraft: false,
              url: "https://github.com/acme/repo/pull/1",
            },
          },
        },
        step1: {
          updatePullRequest: {
            pullRequest: {
              id: "PR_NODE_1",
              number: 2,
              title: "Updated title 2",
              body: "Updated body 2",
              state: "OPEN",
              isDraft: false,
              url: "https://github.com/acme/repo/pull/2",
            },
          },
        },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        {
          task: "pr.update",
          input: {
            owner: "acme",
            name: "repo",
            prNumber: 1,
            title: "Updated title 1",
          },
        },
        {
          task: "pr.update",
          input: {
            owner: "acme",
            name: "repo",
            prNumber: 2,
            body: "Updated body 2",
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

    // Phase 2: batched PrUpdate mutation has the resolved pullRequestId per step
    // and the user-provided title/body fields.
    expect(queryRawMock).toHaveBeenCalledTimes(1)
    const mutationArgs = queryRawMock.mock.calls[0]
    const mutationVars = mutationArgs?.[1] as Record<string, unknown>
    expect(mutationVars.step0_pullRequestId).toBe("PR_NODE_0")
    expect(mutationVars.step0_title).toBe("Updated title 1")
    expect(mutationVars.step1_pullRequestId).toBe("PR_NODE_1")
    expect(mutationVars.step1_body).toBe("Updated body 2")

    expect(result.status).toBe("success")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toMatchObject({ task: "pr.update", ok: true })
    expect(result.results[1]).toMatchObject({ task: "pr.update", ok: true })
  })

  it("passes through optional title and body fields when not provided", async () => {
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: { pullRequest: { id: "PR_NODE_0" } },
      step1: { pullRequest: { id: "PR_NODE_1" } },
    })

    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: {
          updatePullRequest: {
            pullRequest: {
              id: "PR_NODE_0",
              number: 10,
              title: "Original title",
              body: "New body",
              state: "OPEN",
              isDraft: false,
              url: "https://github.com/acme/repo/pull/10",
            },
          },
        },
        step1: {
          updatePullRequest: {
            pullRequest: {
              id: "PR_NODE_1",
              number: 11,
              title: "New title",
              body: "Original body",
              state: "OPEN",
              isDraft: false,
              url: "https://github.com/acme/repo/pull/11",
            },
          },
        },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        {
          task: "pr.update",
          input: { owner: "acme", name: "repo", prNumber: 10, body: "New body" },
        },
        {
          task: "pr.update",
          input: { owner: "acme", name: "repo", prNumber: 11, title: "New title" },
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

    // Phase 2: batched PrUpdate mutation has the resolved pullRequestId.
    // Only the provided fields appear in the mutation variables.
    expect(queryRawMock).toHaveBeenCalledTimes(1)
    const mutationArgs = queryRawMock.mock.calls[0]
    const mutationVars = mutationArgs?.[1] as Record<string, unknown>
    expect(mutationVars.step0_pullRequestId).toBe("PR_NODE_0")
    expect(mutationVars.step0_body).toBe("New body")
    expect(mutationVars).not.toHaveProperty("step0_title")
    expect(mutationVars.step1_pullRequestId).toBe("PR_NODE_1")
    expect(mutationVars.step1_title).toBe("New title")
    expect(mutationVars).not.toHaveProperty("step1_body")

    expect(result.status).toBe("success")
    expect(result.results).toHaveLength(2)
  })
})

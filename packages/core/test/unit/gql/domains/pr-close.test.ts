import { runPrClose } from "@core/gql/domains/pr-mutations.js"
import type { GraphqlTransport } from "@core/gql/transport.js"
import { describe, expect, it, vi } from "vitest"

const baseInput = {
  owner: "acme",
  name: "repo",
  prNumber: 42,
}

describe("runPrClose", () => {
  it("throws when pr node id lookup returns no pr", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runPrClose(transport, baseInput)).rejects.toThrow(
      "Pull request #42 not found in acme/repo",
    )
  })

  it("throws when closePullRequest returns no pull request", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({ closePullRequest: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runPrClose(transport, baseInput)).rejects.toThrow("Failed to close pull request")
  })

  it("returns mapped data on success", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_kwDOA123" } } })
      .mockResolvedValueOnce({
        closePullRequest: {
          pullRequest: {
            id: "PR_kwDOA123",
            number: 42,
            state: "CLOSED",
            closed: true,
          },
        },
      })
    const transport: GraphqlTransport = { execute }

    const result = await runPrClose(transport, baseInput)

    expect(result).toEqual({
      prNumber: 42,
      state: "CLOSED",
      closed: true,
      deleteBranch: false,
    })
  })

  it("throws when deleteBranch is true (must use CLI fallback)", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(runPrClose(transport, { ...baseInput, deleteBranch: true })).rejects.toThrow(
      "deleteBranch operation not available via GraphQL closePullRequest mutation; use the CLI route to delete the branch on close",
    )
    expect(execute).not.toHaveBeenCalled()
  })

  it("passes pullRequestId from PrNodeId lookup to closePullRequest", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ repository: { pullRequest: { id: "PR_node_abc" } } })
      .mockResolvedValueOnce({
        closePullRequest: {
          pullRequest: { id: "PR_node_abc", number: 42, state: "CLOSED", closed: true },
        },
      })
    const transport: GraphqlTransport = { execute }

    await runPrClose(transport, baseInput)

    const secondCall = execute.mock.calls[1]
    expect(secondCall?.[1]).toMatchObject({ pullRequestId: "PR_node_abc" })
  })

  it("rejects invalid input via assertion", async () => {
    const execute = vi.fn()
    const transport: GraphqlTransport = { execute }

    await expect(
      runPrClose(transport, {
        ...baseInput,
        deleteBranch: "yes" as unknown as boolean,
      }),
    ).rejects.toThrow("deleteBranch must be a boolean")
    expect(execute).not.toHaveBeenCalled()
  })
})

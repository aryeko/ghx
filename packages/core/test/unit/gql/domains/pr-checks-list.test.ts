import { describe, expect, it, vi } from "vitest"
import { runPrChecksList } from "../../../../src/gql/domains/pr-queries.js"
import type { GraphqlTransport } from "../../../../src/gql/transport.js"

const baseInput = {
  owner: "acme",
  name: "repo",
  prNumber: 42,
  first: 10,
}

describe("runPrChecksList", () => {
  it("throws when repository is not found", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: null })
    const transport: GraphqlTransport = { execute }

    await expect(runPrChecksList(transport, baseInput)).rejects.toThrow("Pull request not found")
  })

  it("throws when pullRequest is not found", async () => {
    const execute = vi.fn().mockResolvedValue({ repository: { pullRequest: null } })
    const transport: GraphqlTransport = { execute }

    await expect(runPrChecksList(transport, baseInput)).rejects.toThrow("Pull request not found")
  })

  it("returns empty items when check suites are empty", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        pullRequest: {
          commits: {
            nodes: [
              {
                commit: {
                  checkSuites: {
                    nodes: [],
                  },
                },
              },
            ],
          },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runPrChecksList(transport, baseInput)

    expect(result.items).toEqual([])
    expect(result.pageInfo.hasNextPage).toBe(false)
    expect(result.pageInfo.endCursor).toBeNull()
  })

  it("returns mapped check runs on success", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        pullRequest: {
          commits: {
            nodes: [
              {
                commit: {
                  checkSuites: {
                    nodes: [
                      {
                        checkRuns: {
                          nodes: [
                            {
                              id: "CR_1",
                              name: "build",
                              status: "COMPLETED",
                              conclusion: "SUCCESS",
                              detailsUrl: "https://github.com/checks/1",
                            },
                            {
                              id: "CR_2",
                              name: "test",
                              status: "COMPLETED",
                              conclusion: "FAILURE",
                              detailsUrl: null,
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    const result = await runPrChecksList(transport, baseInput)

    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toEqual({
      id: "CR_1",
      name: "build",
      status: "COMPLETED",
      conclusion: "SUCCESS",
      url: "https://github.com/checks/1",
    })
    expect(result.items[1]).toEqual({
      id: "CR_2",
      name: "test",
      status: "COMPLETED",
      conclusion: "FAILURE",
      url: null,
    })
    expect(result.pageInfo.hasNextPage).toBe(false)
    expect(result.pageInfo.endCursor).toBeNull()
  })
})

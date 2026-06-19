import { runIssueList } from "@core/gql/domains/issue-queries.js"
import type { GraphqlTransport } from "@core/gql/transport.js"
import { describe, expect, it, vi } from "vitest"

describe("runIssueList", () => {
  it("forwards state filters to the GraphQL issues query", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        issues: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    await runIssueList(transport, {
      owner: "acme",
      name: "repo",
      first: 30,
      state: "closed",
    })

    expect(execute).toHaveBeenCalledTimes(1)
    const [query, variables] = execute.mock.calls[0] as [string, Record<string, unknown>]
    expect(query).toContain("states: $states")
    expect(variables).toMatchObject({ states: ["CLOSED"] })
  })
})

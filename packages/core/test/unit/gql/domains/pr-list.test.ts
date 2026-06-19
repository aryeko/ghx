import { runPrList } from "@core/gql/domains/pr-queries.js"
import type { GraphqlTransport } from "@core/gql/transport.js"
import { describe, expect, it, vi } from "vitest"

describe("runPrList", () => {
  it("forwards state filters to the GraphQL pullRequests query", async () => {
    const execute = vi.fn().mockResolvedValue({
      repository: {
        pullRequests: {
          nodes: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    })
    const transport: GraphqlTransport = { execute }

    await runPrList(transport, {
      owner: "acme",
      name: "repo",
      first: 30,
      state: "merged",
    } as Parameters<typeof runPrList>[1] & { state: string })

    expect(execute).toHaveBeenCalledTimes(1)
    const [query, variables] = execute.mock.calls[0] as [string, Record<string, unknown>]
    expect(query).toContain("states: $states")
    expect(variables).toMatchObject({ states: ["MERGED"] })
  })
})

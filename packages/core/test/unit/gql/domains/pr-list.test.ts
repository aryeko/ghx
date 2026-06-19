import { runPrList } from "@core/gql/domains/pr-queries.js"
import type { GraphqlTransport } from "@core/gql/transport.js"
import { describe, expect, it, vi } from "vitest"

function createTransport(): { execute: ReturnType<typeof vi.fn>; transport: GraphqlTransport } {
  const execute = vi.fn().mockResolvedValue({
    repository: {
      pullRequests: {
        nodes: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  })
  return { execute, transport: { execute } }
}

describe("runPrList", () => {
  it.each([
    ["merged", "MERGED"],
    ["OPEN", "OPEN"],
    [" closed ", "CLOSED"],
  ])("forwards state %s to the GraphQL pullRequests query", async (inputState, expectedState) => {
    const { execute, transport } = createTransport()

    await runPrList(transport, {
      owner: "acme",
      name: "repo",
      first: 30,
      state: inputState,
    })

    expect(execute).toHaveBeenCalledTimes(1)
    const [query, variables] = execute.mock.calls[0] as [string, Record<string, unknown>]
    expect(query).toContain("states: $states")
    expect(variables).toMatchObject({ states: [expectedState] })
  })

  it.each([
    undefined,
    null,
    "",
    " ",
    "all",
    "ALL",
  ])("omits state filters when state is %s", async (inputState) => {
    const { execute, transport } = createTransport()
    const input: Parameters<typeof runPrList>[1] = {
      owner: "acme",
      name: "repo",
      first: 30,
    }

    if (inputState !== undefined) {
      input.state = inputState
    }

    await runPrList(transport, input)

    expect(execute).toHaveBeenCalledTimes(1)
    const [, variables] = execute.mock.calls[0] as [string, Record<string, unknown>]
    expect(variables.states).toBeUndefined()
  })

  it("throws before executing GraphQL when state is invalid", async () => {
    const { execute, transport } = createTransport()

    await expect(
      runPrList(transport, {
        owner: "acme",
        name: "repo",
        first: 30,
        state: "draft",
      }),
    ).rejects.toThrow("Invalid state for pr.list")

    expect(execute).not.toHaveBeenCalled()
  })
})

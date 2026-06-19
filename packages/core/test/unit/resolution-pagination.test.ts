import { getOperationCard } from "@core/core/registry/index.js"
import type { OperationCard } from "@core/core/registry/types.js"
import { runResolutionPhase } from "@core/core/routing/engine/resolve.js"
import type { ClassifiedStep } from "@core/core/routing/engine/types.js"
import { createResolutionCache } from "@core/core/routing/resolution-cache.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"

function prAssigneesAddStep(cardOverride?: OperationCard): ClassifiedStep {
  const card = cardOverride ?? getOperationCard("pr.assignees.add")
  if (!card) {
    throw new Error("Missing pr.assignees.add card")
  }

  return {
    route: "gql-mutation",
    card,
    index: 0,
    request: {
      task: "pr.assignees.add",
      input: {
        owner: "acme",
        name: "repo",
        prNumber: 1,
        assignees: ["alice"],
      },
    },
  }
}

function githubClientWithQuery(query: GithubClient["query"]): GithubClient {
  return { query } as unknown as GithubClient
}

describe("runResolutionPhase pagination", () => {
  it("fails when a paginated map_array lookup has no endCursor", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      step0: {
        pullRequest: { id: "PR_1" },
        assignableUsers: {
          pageInfo: { hasNextPage: true, endCursor: null },
          nodes: [{ login: "alice", id: "U_alice" }],
        },
      },
    })

    await expect(
      runResolutionPhase(
        [prAssigneesAddStep()],
        [prAssigneesAddStep().request],
        githubClientWithQuery(query),
      ),
    ).rejects.toThrow("hasNextPage is true but endCursor is missing")

    expect(query).toHaveBeenCalledTimes(1)
  })

  it("does not paginate map_array connections when the lookup document has no cursor variable", async () => {
    const base = getOperationCard("pr.assignees.add")
    if (!base?.graphql?.resolution?.lookup) {
      throw new Error("Missing pr.assignees.add resolution")
    }

    const card: OperationCard = {
      ...base,
      graphql: {
        ...base.graphql,
        resolution: {
          ...base.graphql.resolution,
          lookup: {
            ...base.graphql.resolution.lookup,
            operationName: "PrNodeId",
          },
          inject: [
            {
              target: "assigneeIds",
              source: "map_array",
              from_input: "assignees",
              nodes_path: "repository.pullRequest.nodes",
              match_field: "login",
              extract_field: "id",
            },
          ],
        },
      },
    }
    const query = vi.fn().mockResolvedValueOnce({
      step0: {
        pullRequest: {
          pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
          nodes: [{ login: "alice", id: "U_alice" }],
        },
      },
    })

    const result = await runResolutionPhase(
      [prAssigneesAddStep(card)],
      [prAssigneesAddStep(card).request],
      githubClientWithQuery(query),
    )

    expect(query).toHaveBeenCalledTimes(1)
    expect(result[0]?.default).toMatchObject({
      repository: {
        pullRequest: {
          pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
        },
      },
    })
  })

  it("skips missing batch aliases without caching an unresolved lookup", async () => {
    const query = vi.fn().mockResolvedValueOnce({})
    const cache = createResolutionCache()

    const result = await runResolutionPhase(
      [prAssigneesAddStep()],
      [prAssigneesAddStep().request],
      githubClientWithQuery(query),
      cache,
    )

    expect(result).toEqual({})
    expect(cache.size).toBe(0)
  })
})

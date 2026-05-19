import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine/index.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

const fullPrViewResponse = {
  repository: {
    pullRequest: {
      id: "pr-id",
      number: 232,
      title: "Add benchmark improvements",
      state: "OPEN",
      url: "https://github.com/go-modkit/modkit/pull/232",
      body: "Dependabot boilerplate body that we do not want when triaging a list of PRs.",
      labels: { nodes: [{ name: "enhancement" }] },
    },
  },
}

function makeClient() {
  return createGithubClient({
    async execute<TData>(query: string): Promise<TData> {
      if (query.includes("query PrView")) {
        return fullPrViewResponse as TData
      }
      throw new Error("Unexpected query")
    },
  })
}

describe("pr.view exclude input", () => {
  it("strips body from the result when exclude: ['body'] is supplied", async () => {
    const request: TaskRequest = {
      task: "pr.view",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        exclude: ["body"],
      },
    }

    const result = await executeTask(request, {
      githubClient: makeClient(),
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    const data = result.data as Record<string, unknown>
    expect(data.body).toBeUndefined()
    // Other fields remain present
    expect(data).toEqual(
      expect.objectContaining({
        number: 232,
        title: "Add benchmark improvements",
        state: "OPEN",
        labels: ["enhancement"],
      }),
    )
  })

  it("keeps body in the result when exclude is not supplied (default behaviour unchanged)", async () => {
    const request: TaskRequest = {
      task: "pr.view",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
      },
    }

    const result = await executeTask(request, {
      githubClient: makeClient(),
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(true)
    const data = result.data as Record<string, unknown>
    expect(data.body).toBe(
      "Dependabot boilerplate body that we do not want when triaging a list of PRs.",
    )
  })

  it("rejects exclude values outside the enum at card-level input validation", async () => {
    const request: TaskRequest = {
      task: "pr.view",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 232,
        exclude: ["nonexistent"],
      },
    }

    const result = await executeTask(request, {
      githubClient: makeClient(),
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.meta.reason).toBe("INPUT_VALIDATION")
  })
})

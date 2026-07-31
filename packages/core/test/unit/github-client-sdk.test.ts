import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"

describe("createGithubClient typed-document integration", () => {
  it("executes representative generated documents through the transport", async () => {
    const execute = vi.fn(async (query: string, _variables?: Record<string, unknown>) => {
      if (query.includes("query RepoView")) {
        return {
          repository: {
            id: "repo-id",
            name: "modkit",
            nameWithOwner: "go-modkit/modkit",
            isPrivate: false,
            stargazerCount: 10,
            forkCount: 2,
            url: "https://github.com/go-modkit/modkit",
            defaultBranchRef: { name: "main" },
          },
        }
      }
      if (query.includes("query IssueView")) {
        return {
          repository: {
            issue: {
              id: "issue-id",
              number: 42,
              title: "Issue title",
              state: "OPEN",
              url: "https://github.com/go-modkit/modkit/issues/42",
            },
          },
        }
      }
      if (query.includes("query PrView")) {
        return {
          repository: {
            pullRequest: {
              id: "pr-id",
              number: 7,
              title: "PR title",
              state: "OPEN",
              url: "https://github.com/go-modkit/modkit/pull/7",
            },
          },
        }
      }
      throw new Error("Unexpected generated document")
    })
    const client = createGithubClient({
      execute: async <TData>(query: string, variables?: Record<string, unknown>): Promise<TData> =>
        execute(query, variables) as Promise<TData>,
    })

    await client.fetchRepoView({ owner: "go-modkit", name: "modkit" })
    await client.fetchIssueView({ owner: "go-modkit", name: "modkit", issueNumber: 42 })
    await client.fetchPrView({ owner: "go-modkit", name: "modkit", prNumber: 7 })

    expect(execute).toHaveBeenNthCalledWith(1, expect.stringContaining("query RepoView"), {
      owner: "go-modkit",
      name: "modkit",
    })
    expect(execute).toHaveBeenNthCalledWith(2, expect.stringContaining("query IssueView"), {
      owner: "go-modkit",
      name: "modkit",
      issueNumber: 42,
    })
    expect(execute).toHaveBeenNthCalledWith(3, expect.stringContaining("query PrView"), {
      owner: "go-modkit",
      name: "modkit",
      prNumber: 7,
    })
  })
})

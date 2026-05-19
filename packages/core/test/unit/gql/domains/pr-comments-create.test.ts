import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine/index.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask pr.comments.create", () => {
  it("returns success envelope with created comment", async () => {
    let callCount = 0
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        callCount++
        if (callCount === 1) {
          // First call: PrNodeId lookup
          const response = {
            repository: {
              pullRequest: {
                id: "PR_kwDOA123",
              },
            },
          }
          return response as TData
        }
        // Second call: IssueCommentCreate mutation
        const response = {
          addComment: {
            commentEdge: {
              node: {
                id: "IC_pr_comment_1",
                body: "hello from pr test",
                url: "https://github.com/acme/modkit/pull/175#issuecomment-9001",
              },
            },
          },
        }
        return response as TData
      },
    })

    const request: TaskRequest = {
      task: "pr.comments.create",
      input: {
        owner: "acme",
        name: "modkit",
        prNumber: 175,
        body: "hello from pr test",
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    if (!result.ok) {
      console.error("Error:", result.error)
    }
    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      id: "IC_pr_comment_1",
      body: "hello from pr test",
      url: "https://github.com/acme/modkit/pull/175#issuecomment-9001",
    })
  })

  it("returns validation error for missing body", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "pr.comments.create",
      input: { owner: "acme", name: "modkit", prNumber: 175 },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.meta.reason).toBe("INPUT_VALIDATION")
  })

  it("returns validation error for missing prNumber", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "pr.comments.create",
      input: { owner: "acme", name: "modkit", body: "hello" },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("VALIDATION")
    expect(result.meta.reason).toBe("INPUT_VALIDATION")
  })

  it("propagates Pull request not found when lookup returns null", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        const response = { repository: { pullRequest: null } }
        return response as TData
      },
    })

    const request: TaskRequest = {
      task: "pr.comments.create",
      input: {
        owner: "acme",
        name: "modkit",
        prNumber: 999999,
        body: "hello",
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(false)
  })
})

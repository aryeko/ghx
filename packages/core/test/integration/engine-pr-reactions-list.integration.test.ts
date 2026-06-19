import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine/index.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask pr.reactions.list", () => {
  it("returns validation error envelope for missing prNumber", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "pr.reactions.list",
      input: {
        owner: "go-modkit",
        name: "modkit",
      },
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

  it("returns mapped reaction groups on the success path", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: {
              id: "PR_1",
              url: "https://github.com/go-modkit/modkit/pull/7",
              reactionGroups: [
                {
                  content: "THUMBS_UP",
                  viewerHasReacted: true,
                  reactors: {
                    totalCount: 3,
                    nodes: [
                      { __typename: "User", login: "alice" },
                      { __typename: "Bot", login: "dependabot" },
                      null,
                    ],
                  },
                },
                {
                  content: "HEART",
                  viewerHasReacted: false,
                  reactors: {
                    totalCount: 1,
                    nodes: [{ __typename: "Organization", login: "acme" }],
                  },
                },
              ],
            },
          },
        } as TData
      },
    })

    const request: TaskRequest = {
      task: "pr.reactions.list",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 7,
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      subject: {
        type: "PullRequest",
        id: "PR_1",
        url: "https://github.com/go-modkit/modkit/pull/7",
      },
      items: [
        {
          content: "THUMBS_UP",
          reactorCount: 3,
          reactorLogins: ["alice", "dependabot"],
          viewerHasReacted: true,
          reactorsTruncated: true,
        },
        {
          content: "HEART",
          reactorCount: 1,
          reactorLogins: ["acme"],
          viewerHasReacted: false,
          reactorsTruncated: false,
        },
      ],
      filterApplied: { reactorLogin: null, content: null },
    })
  })

  it("applies content and reactorLogin filters on the success path", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          repository: {
            pullRequest: {
              id: "PR_1",
              url: "https://github.com/go-modkit/modkit/pull/7",
              reactionGroups: [
                {
                  content: "THUMBS_UP",
                  viewerHasReacted: false,
                  reactors: {
                    totalCount: 2,
                    nodes: [
                      { __typename: "User", login: "alice" },
                      { __typename: "User", login: "bob" },
                    ],
                  },
                },
                {
                  content: "HEART",
                  viewerHasReacted: false,
                  reactors: {
                    totalCount: 1,
                    nodes: [{ __typename: "User", login: "carol" }],
                  },
                },
              ],
            },
          },
        } as TData
      },
    })

    const request: TaskRequest = {
      task: "pr.reactions.list",
      input: {
        owner: "go-modkit",
        name: "modkit",
        prNumber: 7,
        content: "THUMBS_UP",
        reactorLogin: "alice",
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
      ghCliAvailable: false,
      ghAuthenticated: false,
    })

    expect(result.ok).toBe(true)
    expect(result.data).toEqual({
      subject: {
        type: "PullRequest",
        id: "PR_1",
        url: "https://github.com/go-modkit/modkit/pull/7",
      },
      items: [
        {
          content: "THUMBS_UP",
          reactorCount: 2,
          reactorLogins: ["alice"],
          viewerHasReacted: false,
          reactorsTruncated: false,
        },
      ],
      filterApplied: { reactorLogin: "alice", content: "THUMBS_UP" },
    })
  })
})

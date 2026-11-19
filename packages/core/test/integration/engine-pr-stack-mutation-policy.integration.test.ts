import { executeTask, executeTasks } from "@core/core/routing/engine/index.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"

const repo = { owner: "acme", name: "widget" }
const create = { task: "pr.stack.create", input: { ...repo, prNumbers: [21, 22] } }
const list = { task: "pr.stack.list", input: repo }

describe("native stack mutation policy", () => {
  it.each([[create], [list, create]].map((requests) => ({ requests })))(
    "rejects the entire batch before sending network requests ($requests.length steps)",
    async ({ requests }) => {
      const restFetch = vi.fn<typeof fetch>()
      const githubClient = createGithubClient({
        async execute<T>(): Promise<T> {
          throw new Error("Unexpected GraphQL request")
        },
      })

      const result = await executeTasks(requests, {
        githubClient,
        githubToken: "test-token",
        githubHost: "github.com",
        restFetch,
      })

      expect(result.status).toBe("failed")
      expect(result.results).toHaveLength(requests.length)
      expect(result.results.find(({ task }) => task === create.task)).toMatchObject({
        ok: false,
        error: { code: "VALIDATION", retryable: false },
      })
      expect(restFetch).not.toHaveBeenCalled()
    },
  )
  it("dispatches one write and exposes recovery scope after GitHub returns an ambiguous reply", async () => {
    const target = { id: 12, full_name: "acme/widget" }
    const writes: string[] = []
    const restFetch = vi.fn<typeof fetch>(async (url, init) => {
      const { pathname } = new URL(String(url))
      if (init?.method === "POST") {
        if (typeof init.body !== "string") throw new Error("Expected JSON request body")
        writes.push(init.body)
        return new Response("upstream error", {
          status: 503,
          headers: { "x-github-request-id": "AB01:02EF:034" },
        })
      }
      if (pathname.endsWith("/stacks")) return Response.json([])
      const lower = pathname.endsWith("/21")
      return Response.json({
        number: lower ? 21 : 22,
        state: "open",
        base: { repo: target, ref: lower ? "main" : "schema" },
        head: { repo: target, ref: lower ? "schema" : "api" },
      })
    })
    const githubClient = createGithubClient({
      async execute<T>(): Promise<T> {
        throw new Error("Unexpected GraphQL request")
      },
    })
    const result = await executeTask(create, {
      githubClient,
      githubToken: "test-token",
      githubHost: "github.com",
      restFetch,
    })

    expect(writes).toEqual(['{"pull_requests":[21,22]}'])
    expect(result).toMatchObject({
      ok: false,
      error: {
        retryable: false,
        details: {
          submissionOutcome: "unknown",
          githubRequestId: "AB01:02EF:034",
          repo: "acme/widget",
          prNumbers: [21, 22],
        },
      },
    })
  })
})

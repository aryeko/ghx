import { executeTask, executeTasks } from "@core/core/routing/engine/index.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"

const repo = { owner: "acme", name: "widget" }
const requestId = "630b9d5e-3f2a-4f7e-8b0c-2d5f9a8c1e42"
const heads = ["a".repeat(40), "b".repeat(40), "c".repeat(40)]
const stack = {
  number: 200,
  base: { ref: "main" },
  open: true,
  pull_requests: [21, 22, 23].map((number, index) => ({
    number,
    state: "open",
    merged_at: null,
    draft: false,
    head: { ref: `layer-${number}`, sha: heads[index] },
    base: { ref: index === 0 ? "main" : `layer-${number - 1}` },
    node_id: `PR_${number}`,
  })),
}
const preview = {
  ...repo,
  stackNumber: 200,
  throughPrNumber: 22,
  expectedBaseRefName: "main",
  expectedMembers: [
    { prNumber: 21, headSha: heads[0] },
    { prNumber: 22, headSha: heads[1] },
  ],
}
const githubClient = createGithubClient({
  async execute<T>(): Promise<T> {
    throw new Error("Unexpected GraphQL request")
  },
})

describe("native stack merge dispatch", () => {
  it("submits the selected head once and exposes queue admission through request lookup", async () => {
    const restFetch = vi.fn<typeof fetch>(async (url, init) => {
      const { pathname } = new URL(String(url))
      if (pathname.endsWith("/stacks/200")) return Response.json(stack)
      if (pathname.endsWith(`/22/merge-async/${requestId}`)) {
        return Response.json({ status: "enqueued", details: { message: "Added to queue" } })
      }
      if (init?.method !== "PUT" || !pathname.endsWith("/22/merge-async")) {
        throw new Error("Unexpected merge request")
      }
      return Response.json(
        {
          status: "pending",
          details: {
            uuid: requestId,
            merge_method: "default",
            merge_action: "default",
            expected_head_sha: heads[1],
          },
        },
        { status: 202 },
      )
    })
    const deps = { githubClient, githubToken: "test-token", restFetch }

    const submit = await executeTask({ task: "pr.stack.merge", input: preview }, deps)
    expect(submit).toMatchObject({
      ok: true,
      data: { status: "pending", requestId, previewPrNumbers: [21, 22] },
    })
    const writes = restFetch.mock.calls.filter(([, init]) => init?.method === "PUT")
    expect(writes).toHaveLength(1)
    expect(writes[0]?.[1]?.body).toBe(JSON.stringify({ sha: heads[1], merge_action: "default" }))

    const poll = await executeTasks(
      [{ task: "pr.merge.request.view", input: { ...repo, prNumber: 22, requestId } }],
      deps,
    )
    expect(poll).toMatchObject({
      status: "success",
      results: [{ ok: true, data: { status: "enqueued", requestId } }],
    })
    expect(poll.results[0]?.data).not.toHaveProperty("mergeCommitSha")
  })

  it("rejects an async stack merge in chain before any preflight requests", async () => {
    const restFetch = vi.fn<typeof fetch>()
    const result = await executeTasks([{ task: "pr.stack.merge", input: preview }], {
      githubClient,
      githubToken: "test-token",
      restFetch,
    })
    expect(result.status).toBe("failed")
    expect(result.results[0]?.error?.code).toBe("VALIDATION")
    expect(restFetch).not.toHaveBeenCalled()
  })
})

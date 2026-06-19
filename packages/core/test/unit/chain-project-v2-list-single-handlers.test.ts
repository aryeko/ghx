import { executeTasks } from "@core/core/routing/engine/index.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"

describe("executeTasks chaining - project_v2 list handlers", () => {
  it("runs org/user fallback project lists through non-batchable single handlers", async () => {
    const queryMock = vi.fn()
    const fetchProjectV2FieldsList = vi.fn().mockResolvedValue({
      items: [{ id: "F_1", name: "Status", dataType: "SINGLE_SELECT", options: [] }],
      pageInfo: { hasNextPage: false, endCursor: null },
    })
    const fetchProjectV2ItemsList = vi.fn().mockResolvedValue({
      items: [{ id: "PVTI_1", contentType: "ISSUE", contentNumber: 42, contentTitle: "Fix bug" }],
      pageInfo: { hasNextPage: false, endCursor: null },
    })

    const result = await executeTasks(
      [
        {
          task: "project_v2.fields.list",
          input: { owner: "octocat", projectNumber: 1 },
        },
        {
          task: "project_v2.items.list",
          input: { owner: "octocat", projectNumber: 1, first: 10 },
        },
      ],
      {
        githubToken: "test-token",
        githubClient: createGithubClient({
          fetchProjectV2FieldsList,
          fetchProjectV2ItemsList,
          query: queryMock,
          queryRaw: vi.fn(),
        }),
      },
    )

    expect(result.status).toBe("success")
    expect(result.meta.route_used).toBe("graphql")
    expect(queryMock).not.toHaveBeenCalled()
    expect(fetchProjectV2FieldsList).toHaveBeenCalledWith({
      owner: "octocat",
      projectNumber: 1,
      first: 30,
    })
    expect(fetchProjectV2ItemsList).toHaveBeenCalledWith({
      owner: "octocat",
      projectNumber: 1,
      first: 10,
    })
    expect(result.results[0]).toMatchObject({
      ok: true,
      data: {
        items: [{ id: "F_1", name: "Status" }],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    })
    expect(result.results[1]).toMatchObject({
      ok: true,
      data: {
        items: [{ id: "PVTI_1", contentNumber: 42 }],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    })
  })
})

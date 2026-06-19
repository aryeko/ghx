import { executeTasks } from "@core/core/routing/engine/index.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"

describe("executeTasks chaining - issue set mutator variable contract", () => {
  it("injects issueId for label and assignee replacement mutations", async () => {
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: {
        issue: { id: "ISSUE_0" },
        labels: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [{ name: "bug", id: "LABEL_bug" }],
        },
      },
      step1: {
        issue: { id: "ISSUE_1" },
        assignableUsers: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [{ login: "octocat", id: "USER_octocat" }],
        },
      },
    })

    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: { updateIssue: { issue: { id: "ISSUE_0", labels: { nodes: [] } } } },
        step1: { updateIssue: { issue: { id: "ISSUE_1", assignees: { nodes: [] } } } },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        {
          task: "issue.labels.set",
          input: { owner: "acme", name: "repo", issueNumber: 1, labels: ["bug"] },
        },
        {
          task: "issue.assignees.set",
          input: { owner: "acme", name: "repo", issueNumber: 2, assignees: ["octocat"] },
        },
      ],
      {
        githubClient: createGithubClient({
          query: queryMock,
          queryRaw: queryRawMock,
        }),
      },
    )

    expect(queryRawMock).toHaveBeenCalledTimes(1)
    const mutationVars = queryRawMock.mock.calls[0]?.[1] as Record<string, unknown>
    expect(mutationVars.step0_issueId).toBe("ISSUE_0")
    expect(mutationVars.step0_labelIds).toEqual(["LABEL_bug"])
    expect(mutationVars).not.toHaveProperty("step0_labelableId")
    expect(mutationVars.step1_issueId).toBe("ISSUE_1")
    expect(mutationVars.step1_assigneeIds).toEqual(["USER_octocat"])
    expect(mutationVars).not.toHaveProperty("step1_assignableId")
    expect(result.status).toBe("success")
  })
})

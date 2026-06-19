import { executeTasks } from "@core/core/routing/engine/index.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"

describe("executeTasks chaining - project v2 item variable contracts", () => {
  it("resolves projectId with org/user fallback and resolves issue contentId for item add", async () => {
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0_projectOrg: { projectV2: { id: "PROJECT_ORG" } },
      step0_projectUser: null,
      step0_content: { __typename: "Issue", id: "ISSUE_0" },
      step1_projectOrg: null,
      step1_projectUser: { projectV2: { id: "PROJECT_USER" } },
      step1_content: { __typename: "Issue", id: "ISSUE_1" },
    })

    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: { addProjectV2ItemById: { item: { id: "ITEM_0", type: "ISSUE" } } },
        step1: { addProjectV2ItemById: { item: { id: "ITEM_1", type: "ISSUE" } } },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        {
          task: "project_v2.items.issue.add",
          input: {
            owner: "acme-org",
            projectNumber: 1,
            issueUrl: "https://github.com/acme/repo/issues/1",
          },
        },
        {
          task: "project_v2.items.issue.add",
          input: {
            owner: "acme-user",
            projectNumber: 2,
            issueUrl: "https://github.com/acme/repo/issues/2",
          },
        },
      ],
      {
        githubClient: createGithubClient({
          query: queryMock,
          queryRaw: queryRawMock,
        }),
      },
    )

    expect(queryMock).toHaveBeenCalledTimes(1)
    const lookupVars = queryMock.mock.calls[0]?.[1] as Record<string, unknown>
    expect(lookupVars.step0_projectOrg_org).toBe("acme-org")
    expect(lookupVars.step0_projectUser_login).toBe("acme-org")
    expect(lookupVars.step0_content_url).toBe("https://github.com/acme/repo/issues/1")
    expect(lookupVars.step1_projectOrg_org).toBe("acme-user")
    expect(lookupVars.step1_projectUser_login).toBe("acme-user")
    expect(lookupVars.step1_content_url).toBe("https://github.com/acme/repo/issues/2")

    expect(queryRawMock).toHaveBeenCalledTimes(1)
    const mutationVars = queryRawMock.mock.calls[0]?.[1] as Record<string, unknown>
    expect(mutationVars.step0_projectId).toBe("PROJECT_ORG")
    expect(mutationVars.step0_contentId).toBe("ISSUE_0")
    expect(mutationVars.step1_projectId).toBe("PROJECT_USER")
    expect(mutationVars.step1_contentId).toBe("ISSUE_1")
    expect(result.status).toBe("success")
  })

  it("resolves projectId with org/user fallback for item remove", async () => {
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0_projectOrg: null,
      step0_projectUser: { projectV2: { id: "PROJECT_USER_0" } },
      step1_projectOrg: { projectV2: { id: "PROJECT_ORG_1" } },
      step1_projectUser: null,
    })

    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: { deleteProjectV2Item: { deletedItemId: "ITEM_0" } },
        step1: { deleteProjectV2Item: { deletedItemId: "ITEM_1" } },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        {
          task: "project_v2.items.issue.remove",
          input: { owner: "acme-user", projectNumber: 1, itemId: "ITEM_0" },
        },
        {
          task: "project_v2.items.issue.remove",
          input: { owner: "acme-org", projectNumber: 2, itemId: "ITEM_1" },
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
    expect(mutationVars.step0_projectId).toBe("PROJECT_USER_0")
    expect(mutationVars.step0_itemId).toBe("ITEM_0")
    expect(mutationVars.step1_projectId).toBe("PROJECT_ORG_1")
    expect(mutationVars.step1_itemId).toBe("ITEM_1")
    expect(result.status).toBe("success")
  })

  it("synthesizes ProjectV2FieldValue variables from card inputs", async () => {
    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: { updateProjectV2ItemFieldValue: { projectV2Item: { id: "ITEM_0" } } },
        step1: { updateProjectV2ItemFieldValue: { projectV2Item: { id: "ITEM_1" } } },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        {
          task: "project_v2.items.field.update",
          input: {
            projectId: "PROJECT_0",
            itemId: "ITEM_0",
            fieldId: "FIELD_0",
            valueText: "Ready",
          },
        },
        {
          task: "project_v2.items.field.update",
          input: {
            projectId: "PROJECT_1",
            itemId: "ITEM_1",
            fieldId: "FIELD_1",
            clear: true,
          },
        },
      ],
      {
        githubClient: createGithubClient({
          query: vi.fn(),
          queryRaw: queryRawMock,
        }),
      },
    )

    expect(queryRawMock).toHaveBeenCalledTimes(1)
    const mutationVars = queryRawMock.mock.calls[0]?.[1] as Record<string, unknown>
    expect(mutationVars.step0_projectId).toBe("PROJECT_0")
    expect(mutationVars.step0_itemId).toBe("ITEM_0")
    expect(mutationVars.step0_fieldId).toBe("FIELD_0")
    expect(mutationVars.step0_value).toEqual({ text: "Ready" })
    expect(mutationVars.step1_projectId).toBe("PROJECT_1")
    expect(mutationVars.step1_itemId).toBe("ITEM_1")
    expect(mutationVars.step1_fieldId).toBe("FIELD_1")
    expect(mutationVars.step1_value).toEqual({})
    expect(result.status).toBe("success")
  })
})

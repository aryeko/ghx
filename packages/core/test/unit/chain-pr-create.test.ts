import { executeTasks } from "@core/core/routing/engine/index.js"
import { describe, expect, it, vi } from "vitest"
import { createGithubClient } from "../helpers/engine-fixtures.js"

describe("executeTasks chaining - pr.create variable contract", () => {
  it("resolves repositoryId and maps head/base inputs for a batched create", async () => {
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: { id: "REPO_0" },
      step1: { id: "REPO_1" },
    })

    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: {
          createPullRequest: {
            pullRequest: {
              id: "PR_0",
              number: 1,
              title: "First PR",
              state: "OPEN",
              url: "https://github.com/acme/repo/pull/1",
              isDraft: false,
            },
          },
        },
        step1: {
          createPullRequest: {
            pullRequest: {
              id: "PR_1",
              number: 2,
              title: "Second PR",
              state: "OPEN",
              url: "https://github.com/acme/repo/pull/2",
              isDraft: true,
            },
          },
        },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        {
          task: "pr.create",
          input: {
            owner: "acme",
            name: "repo",
            title: "First PR",
            head: "feature-a",
            base: "main",
          },
        },
        {
          task: "pr.create",
          input: {
            owner: "acme",
            name: "repo",
            title: "Second PR",
            body: "Body text",
            head: "feature-b",
            base: "develop",
            draft: true,
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
    expect(lookupVars.step0_owner).toBe("acme")
    expect(lookupVars.step0_name).toBe("repo")
    expect(lookupVars.step1_owner).toBe("acme")
    expect(lookupVars.step1_name).toBe("repo")

    expect(queryRawMock).toHaveBeenCalledTimes(1)
    const mutationVars = queryRawMock.mock.calls[0]?.[1] as Record<string, unknown>
    expect(mutationVars.step0_repositoryId).toBe("REPO_0")
    expect(mutationVars.step0_baseRefName).toBe("main")
    expect(mutationVars.step0_headRefName).toBe("feature-a")
    expect(mutationVars.step0_title).toBe("First PR")
    expect(mutationVars).not.toHaveProperty("step0_body")
    expect(mutationVars).not.toHaveProperty("step0_draft")
    expect(mutationVars.step1_repositoryId).toBe("REPO_1")
    expect(mutationVars.step1_baseRefName).toBe("develop")
    expect(mutationVars.step1_headRefName).toBe("feature-b")
    expect(mutationVars.step1_title).toBe("Second PR")
    expect(mutationVars.step1_body).toBe("Body text")
    expect(mutationVars.step1_draft).toBe(true)
    expect(result.status).toBe("success")
  })
})

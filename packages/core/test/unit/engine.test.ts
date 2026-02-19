import type { OperationCard } from "@core/core/registry/types.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

const executeMock = vi.fn()
const getOperationCardMock = vi.fn()

vi.mock("@core/core/execute/execute.js", () => ({
  execute: (...args: unknown[]) => executeMock(...args),
}))

vi.mock("@core/core/registry/index.js", () => ({
  getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
}))

const baseCard: OperationCard = {
  capability_id: "repo.view",
  version: "1.0.0",
  description: "Fetch repository",
  input_schema: { type: "object" },
  output_schema: { type: "object" },
  routing: {
    preferred: "graphql",
    fallbacks: ["cli"],
  },
}

function createGithubClient(overrides?: Partial<GithubClient>): GithubClient {
  return {
    fetchRepoView: vi.fn(),
    fetchIssueCommentsList: vi.fn(),
    fetchIssueList: vi.fn(),
    fetchIssueView: vi.fn(),
    fetchPrList: vi.fn(),
    fetchPrView: vi.fn(),
    fetchPrCommentsList: vi.fn(),
    fetchPrReviewsList: vi.fn(),
    fetchPrDiffListFiles: vi.fn(),
    fetchPrMergeStatus: vi.fn(),
    replyToReviewThread: vi.fn(),
    resolveReviewThread: vi.fn(),
    unresolveReviewThread: vi.fn(),
    submitPrReview: vi.fn(),
    query: vi.fn(),
    ...overrides,
  } as unknown as GithubClient
}

describe("executeTask engine wiring", () => {
  beforeEach(() => {
    executeMock.mockReset()
    getOperationCardMock.mockReset()
    getOperationCardMock.mockReturnValue(baseCard)
  })

  it("exposes REST fallback envelope via execute route callbacks", async () => {
    executeMock.mockImplementation(
      async (options: {
        routes: { rest: (params: Record<string, unknown>) => Promise<unknown> }
      }) => {
        return options.routes.rest({})
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")

    const result = await executeTask(
      {
        task: "repo.view",
        input: { owner: "acme", name: "modkit" },
      },
      {
        githubClient: createGithubClient(),
      },
    )

    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(executeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        card: baseCard,
        params: { owner: "acme", name: "modkit" },
        preflight: expect.any(Function),
        routes: expect.objectContaining({
          graphql: expect.any(Function),
          cli: expect.any(Function),
          rest: expect.any(Function),
        }),
      }),
    )

    expect(result.ok).toBe(false)
    expect(result.error?.code).toBe("ADAPTER_UNSUPPORTED")
    expect(result.meta.route_used).toBe("rest")
    expect(result.meta.reason).toBe("DEFAULT_POLICY")
  })

  it("skips cli preflight probes when skipGhPreflight is true", async () => {
    const cliRunner = {
      run: vi.fn(async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "",
      })),
    }

    executeMock.mockImplementation(
      async (options: { preflight: (route: "cli") => Promise<{ ok: boolean }> }) => {
        return options.preflight("cli")
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")

    const result = await executeTask(
      {
        task: "repo.view",
        input: { owner: "acme", name: "modkit" },
      },
      {
        githubClient: createGithubClient(),
        cliRunner,
        skipGhPreflight: true,
      },
    )

    expect(cliRunner.run).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
  })

  it("detects missing CLI and returns cli preflight failure", async () => {
    const cliRunner = {
      run: vi.fn(async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "",
      })),
    }
    executeMock.mockImplementation(
      async (options: { preflight: (route: "cli") => Promise<{ ok: boolean; code?: string }> }) => {
        return options.preflight("cli")
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")
    const result = await executeTask(
      {
        task: "repo.view",
        input: { owner: "acme", name: "modkit" },
      },
      {
        githubClient: createGithubClient(),
        cliRunner,
      },
    )

    expect(cliRunner.run).toHaveBeenCalledWith("gh", ["--version"], 1_500)
    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: "ADAPTER_UNSUPPORTED",
      }),
    )
  })

  it("handles CLI detection runner errors as unavailable", async () => {
    const cliRunner = {
      run: vi.fn(async () => {
        throw new Error("spawn failed")
      }),
    }
    executeMock.mockImplementation(
      async (options: { preflight: (route: "cli") => Promise<{ ok: boolean; code?: string }> }) => {
        return options.preflight("cli")
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")
    const result = await executeTask(
      {
        task: "repo.view",
        input: { owner: "acme", name: "modkit" },
      },
      {
        githubClient: createGithubClient(),
        cliRunner,
      },
    )

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        code: "ADAPTER_UNSUPPORTED",
      }),
    )
  })

  it("handles cached CLI probe post-processing errors by clearing in-flight entry", async () => {
    const cliRunner = {
      run: vi
        .fn()
        .mockResolvedValueOnce({ exitCode: 0, stdout: "gh version 1", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" }),
    }
    executeMock.mockImplementation(
      async (options: { preflight: (route: "cli") => Promise<{ ok: boolean; code?: string }> }) => {
        return options.preflight("cli")
      },
    )

    const nowSpy = vi.spyOn(Date, "now")
    nowSpy.mockImplementationOnce(() => {
      throw new Error("clock unavailable")
    })
    nowSpy.mockImplementation(() => 0)

    const { executeTask } = await import("@core/core/routing/engine.js")

    await expect(
      executeTask(
        {
          task: "repo.view",
          input: { owner: "acme", name: "modkit" },
        },
        {
          githubClient: createGithubClient(),
          cliRunner,
        },
      ),
    ).rejects.toThrow("clock unavailable")

    await expect(
      executeTask(
        {
          task: "repo.view",
          input: { owner: "acme", name: "modkit" },
        },
        {
          githubClient: createGithubClient(),
          cliRunner,
        },
      ),
    ).resolves.toEqual({ ok: true })

    nowSpy.mockRestore()
  })
})

describe("executeTasks chaining", () => {
  beforeEach(() => {
    executeMock.mockReset()
    getOperationCardMock.mockReset()
  })

  it("1-item chain delegates to executeTask path", async () => {
    getOperationCardMock.mockReturnValue(baseCard)
    executeMock.mockResolvedValue({ ok: true, data: { id: "test" } })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [{ task: "repo.view", input: { owner: "acme", name: "modkit" } }],
      {
        githubClient: createGithubClient(),
      },
    )

    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(result.status).toBe("success")
    expect(result.results).toHaveLength(1)
    expect(result.results[0]).toMatchObject({ task: "repo.view", ok: true, data: { id: "test" } })
  })

  it("pre-flight rejects whole chain if card not found", async () => {
    getOperationCardMock.mockReturnValue(null)

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "unknown.task", input: {} },
        { task: "repo.view", input: {} },
      ],
      {
        githubClient: createGithubClient(),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results).toHaveLength(2)
    const firstResult = result.results[0]
    expect(firstResult).toBeDefined()
    expect(firstResult?.ok).toBe(false)
    expect(firstResult?.error?.code).toBe("VALIDATION")
  })

  it("pre-flight rejects whole chain if card has no graphql config", async () => {
    const cardWithoutGql = {
      ...baseCard,
      routing: { preferred: "cli", fallbacks: [] },
      graphql: undefined,
    }
    getOperationCardMock.mockReturnValue(cardWithoutGql)

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "repo.view", input: { owner: "acme", name: "modkit" } },
        { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      ],
      {
        githubClient: createGithubClient(),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results.every((r) => !r.ok)).toBe(true)
  })

  it("2-item pure-mutation chain returns success after batch mutation", async () => {
    const cardWithGql = {
      ...baseCard,
      graphql: {
        operationName: "IssueCreate",
        documentPath: "src/gql/operations/issue-create.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(cardWithGql)

    const getLookupDocumentMock = vi.fn()
    const getMutationDocumentMock = vi.fn()
    const buildBatchMutationMock = vi.fn()
    const applyInjectMock = vi.fn()

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: getLookupDocumentMock,
      getMutationDocument: getMutationDocumentMock,
    }))

    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: buildBatchMutationMock,
    }))

    vi.doMock("@core/gql/resolve.js", () => ({
      applyInject: applyInjectMock,
    }))

    getMutationDocumentMock.mockReturnValue(
      `mutation IssueCreate($repositoryId: ID!, $title: String!) { createIssue(input: {repositoryId: $repositoryId, title: $title}) { issue { id } } }`,
    )

    buildBatchMutationMock.mockReturnValue({
      document: `mutation BatchComposite(...) { step0: createIssue(...) { issue { id } } step1: createIssue(...) { issue { id } } }`,
      variables: {
        step0_repositoryId: "R1",
        step0_title: "Issue 1",
        step1_repositoryId: "R2",
        step1_title: "Issue 2",
      },
    })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.create", input: { repositoryId: "R1", title: "Issue 1" } },
        { task: "issue.create", input: { repositoryId: "R2", title: "Issue 2" } },
      ],
      {
        githubClient: createGithubClient({
          query: vi
            .fn()
            .mockResolvedValue({ step0: { issue: { id: "I1" } }, step1: { issue: { id: "I2" } } }),
        }),
      },
    )

    expect(result.status).toBe("success")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toMatchObject({ task: "issue.create", ok: true })
    expect(result.results[1]).toMatchObject({ task: "issue.create", ok: true })
  })

  it("status is partial when one step fails", async () => {
    const cardWithGql = {
      ...baseCard,
      graphql: {
        operationName: "IssueCreate",
        documentPath: "src/gql/operations/issue-create.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(cardWithGql)

    const getMutationDocumentMock = vi.fn()
    const buildBatchMutationMock = vi.fn()

    vi.doMock("@core/gql/document-registry.js", () => ({
      getMutationDocument: getMutationDocumentMock,
    }))

    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: buildBatchMutationMock,
    }))

    getMutationDocumentMock.mockReturnValue(
      `mutation IssueCreate($repositoryId: ID!, $title: String!) { createIssue(input: {repositoryId: $repositoryId, title: $title}) { issue { id } } }`,
    )

    buildBatchMutationMock.mockReturnValue({
      document: `mutation BatchComposite(...) { step0: createIssue(...) { issue { id } } step1: createIssue(...) { issue { id } } }`,
      variables: {
        step0_repositoryId: "R1",
        step0_title: "Issue 1",
        step1_repositoryId: "R2",
        step1_title: "Issue 2",
      },
    })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.create", input: { repositoryId: "R1", title: "Issue 1" } },
        { task: "issue.create", input: { repositoryId: "R2", title: "Issue 2" } },
      ],
      {
        githubClient: createGithubClient({
          query: vi.fn().mockRejectedValueOnce(new Error("second mutation failed")),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[1]?.ok).toBe(false)
  })
})

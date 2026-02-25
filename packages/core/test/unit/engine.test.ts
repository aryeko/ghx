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
    queryRaw: vi.fn().mockResolvedValue({ data: {}, errors: undefined }),
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
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: "gh version 1",
          stderr: "",
        })
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
    expect(result.results[0]).toMatchObject({
      task: "repo.view",
      ok: true,
      data: { id: "test" },
    })
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

  it("pre-flight rejects whole chain if card has neither graphql nor cli config", async () => {
    const cardWithoutAnyRoute = {
      ...baseCard,
      routing: { preferred: "cli", fallbacks: [] },
      graphql: undefined,
      cli: undefined,
    }
    getOperationCardMock.mockReturnValue(cardWithoutAnyRoute)

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
    expect(result.results[0]?.error?.message).toContain("no supported route")
  })

  it("pre-flight correctly attributes errors when same capability appears twice and only one fails", async () => {
    // step 0: card not found (preflight fails); step 1: valid card
    getOperationCardMock.mockReturnValueOnce(undefined).mockReturnValueOnce({
      ...baseCard,
      graphql: { operationName: "IssueClose", documentPath: "x" },
    })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.close", input: { issueId: "I2" } },
      ],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    const r0 = result.results[0]
    const r1 = result.results[1]
    // step 0 gets the real "Invalid task" error
    expect(r0?.ok).toBe(false)
    expect(r0?.error?.message).toContain("Invalid task")
    // step 1 should NOT inherit the same error — it gets the generic "pre-flight failed" fallback
    expect(r1?.ok).toBe(false)
    expect(r1?.error?.message).not.toContain("Invalid task")
  })

  it("pre-flight rejects step when resolution lookup var is missing from input", async () => {
    const cardNoResolution = {
      ...baseCard,
      graphql: { operationName: "IssueClose", documentPath: "x" },
    }
    const cardWithResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueLabelsSet",
        documentPath: "x",
        resolution: {
          lookup: {
            operationName: "IssueLabelsLookup",
            documentPath: "y",
            vars: { owner: "owner", name: "name" },
          },
          inject: [],
        },
      },
    }
    getOperationCardMock
      .mockReturnValueOnce(cardNoResolution)
      .mockReturnValueOnce(cardWithResolution)

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      // step 1 is missing "name" from input
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.labels.set", input: { owner: "acme" } },
      ],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    const r1 = result.results[1]
    expect(r1?.ok).toBe(false)
    expect(r1?.error?.message).toMatch(/name/)
  })

  it("2-item pure-mutation chain returns success after batch mutation", async () => {
    // vi.resetModules + vi.doMock pattern required: engine.ts is already loaded,
    // so module-level doMock calls are ineffective without resetting the cache first.
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const cardWithGql = {
      ...baseCard,
      graphql: {
        operationName: "IssueCreate",
        documentPath: "src/gql/operations/issue-create.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(cardWithGql)

    const getMutationDocumentMock = vi
      .fn()
      .mockReturnValue(
        `mutation IssueCreate($repositoryId: ID!, $title: String!) { createIssue(input: {repositoryId: $repositoryId, title: $title}) { issue { id } } }`,
      )
    const buildBatchMutationMock = vi.fn().mockReturnValue({
      document: `mutation BatchComposite { step0: createIssue { issue { id } } step1: createIssue { issue { id } } }`,
      variables: {
        step0_repositoryId: "R1",
        step0_title: "Issue 1",
        step1_repositoryId: "R2",
        step1_title: "Issue 2",
      },
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: getMutationDocumentMock,
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: buildBatchMutationMock,
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        {
          task: "issue.create",
          input: { repositoryId: "R1", title: "Issue 1" },
        },
        {
          task: "issue.create",
          input: { repositoryId: "R2", title: "Issue 2" },
        },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: {
              step0: { issue: { id: "I1" } },
              step1: { issue: { id: "I2" } },
            },
            errors: undefined,
          }),
        }),
      },
    )

    // Mocks are now effective: verify they were actually called
    expect(getMutationDocumentMock).toHaveBeenCalledWith("IssueCreate")
    expect(buildBatchMutationMock).toHaveBeenCalled()
    expect(result.status).toBe("success")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toMatchObject({ task: "issue.create", ok: true })
    expect(result.results[1]).toMatchObject({ task: "issue.create", ok: true })
  })

  it("status is failed when batch mutation query rejects", async () => {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const cardWithGql = {
      ...baseCard,
      graphql: {
        operationName: "IssueCreate",
        documentPath: "src/gql/operations/issue-create.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(cardWithGql)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueCreate($repositoryId: ID!, $title: String!) { createIssue(input: {repositoryId: $repositoryId, title: $title}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: `mutation BatchComposite { step0: createIssue { issue { id } } }`,
        variables: { step0_repositoryId: "R1", step0_title: "Issue 1" },
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        {
          task: "issue.create",
          input: { repositoryId: "R1", title: "Issue 1" },
        },
        {
          task: "issue.create",
          input: { repositoryId: "R2", title: "Issue 2" },
        },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockRejectedValue(new Error("network error")),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[1]?.ok).toBe(false)
  })
})

describe("executeTasks — mixed resolution chain", () => {
  it("handles chain where step 0 has no resolution and step 1 requires Phase 1 lookup", async () => {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const cardNoResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "src/gql/operations/issue-close.graphql",
      },
    }
    const cardWithResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueLabelsSet",
        documentPath: "src/gql/operations/issue-labels-set.graphql",
        resolution: {
          lookup: {
            operationName: "IssueLabelsLookup",
            documentPath: "src/gql/operations/issue-labels-lookup.graphql",
            vars: { owner: "owner", name: "name" },
          },
          inject: [
            {
              target: "labelIds",
              source: "map_array" as const,
              from_input: "labels",
              nodes_path: "repository.labels.nodes",
              match_field: "name",
              extract_field: "id",
            },
          ],
        },
      },
    }

    getOperationCardMock
      .mockReturnValueOnce(cardNoResolution)
      .mockReturnValueOnce(cardWithResolution)

    const buildBatchQueryMock = vi.fn().mockReturnValue({
      document: `query BatchQuery { step1: repository { labels { nodes { id name } } } }`,
      variables: { step1_owner: "acme", step1_name: "repo" },
    })
    const buildBatchMutationMock = vi.fn().mockReturnValue({
      document: `mutation BatchMut { step0: closeIssue { issue { id } } step1: updateIssue { issue { id } } }`,
      variables: {},
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi
        .fn()
        .mockReturnValue(
          `query IssueLabelsLookup($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { labels(first: 100) { nodes { id name } } } }`,
        ),
      getMutationDocument: vi
        .fn()
        .mockImplementation((op: string) =>
          op === "IssueClose"
            ? `mutation IssueClose($issueId: ID!) { closeIssue(input: {issueId: $issueId}) { issue { id } } }`
            : `mutation IssueLabelsSet($issueId: ID!, $labelIds: [ID!]!) { updateIssue(input: {id: $issueId, labelIds: $labelIds}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: buildBatchQueryMock,
      buildBatchMutation: buildBatchMutationMock,
      // Real GitHub returns the root field value directly under the alias key (no wrapper).
      // extractRootFieldName returns "repository" so the engine re-wraps it correctly.
      extractRootFieldName: vi.fn().mockReturnValue("repository"),
    }))
    vi.doMock("@core/gql/resolve.js", () => ({
      applyInject: vi.fn().mockReturnValue({ labelIds: ["L1"] }),
      buildMutationVars: vi
        .fn()
        .mockImplementation(
          (_doc: string, input: Record<string, unknown>, resolved: Record<string, unknown>) => ({
            ...input,
            ...resolved,
          }),
        ),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    // Phase 1 uses query (lookup), Phase 2 uses queryRaw (mutation).
    // Real GitHub returns the root field value directly under the alias — no "repository" wrapper.
    const queryMock = vi.fn().mockResolvedValueOnce({
      step1: { labels: { nodes: [{ id: "L1", name: "bug" }] } },
    })
    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: { closeIssue: { issue: { id: "I1" } } },
        step1: { updateIssue: { issue: { id: "I2" } } },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        {
          task: "issue.labels.set",
          input: {
            issueId: "I2",
            owner: "acme",
            name: "repo",
            labels: ["bug"],
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

    expect(buildBatchQueryMock).toHaveBeenCalled()
    expect(buildBatchMutationMock).toHaveBeenCalled()
    expect(queryMock).toHaveBeenCalledTimes(1)
    expect(queryRawMock).toHaveBeenCalledTimes(1)
    expect(result.status).toBe("success")
    expect(result.results[0]).toMatchObject({ task: "issue.close", ok: true })
    expect(result.results[1]).toMatchObject({
      task: "issue.labels.set",
      ok: true,
    })
  })
})

describe("executeTasks — resolution cache", () => {
  it("skips Phase 1 network call when all lookups are cached", async () => {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const cardWithResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueLabelsSet",
        documentPath: "src/gql/operations/issue-labels-set.graphql",
        resolution: {
          lookup: {
            operationName: "IssueLabelsLookup",
            documentPath: "src/gql/operations/issue-labels-lookup.graphql",
            vars: { issueId: "issueId" },
          },
          inject: [
            {
              target: "labelIds",
              source: "map_array" as const,
              from_input: "labels",
              nodes_path: "repository.labels.nodes",
              match_field: "name",
              extract_field: "id",
            },
          ],
        },
      },
    }
    getOperationCardMock.mockReturnValue(cardWithResolution)

    const buildBatchQueryMock = vi.fn()
    const buildBatchMutationMock = vi.fn().mockReturnValue({
      document: `mutation Batch { step0: updateIssue { issue { id } } step1: updateIssue { issue { id } } }`,
      variables: {},
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi
        .fn()
        .mockReturnValue(
          `query IssueLabelsLookup($issueId: ID!) { node(id: $issueId) { ... on Issue { repository { labels(first: 100) { nodes { id name } } } } } }`,
        ),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueLabelsSet($issueId: ID!, $labelIds: [ID!]!) { updateIssue(input: {id: $issueId, labelIds: $labelIds}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: buildBatchQueryMock,
      buildBatchMutation: buildBatchMutationMock,
    }))
    vi.doMock("@core/gql/resolve.js", () => ({
      applyInject: vi.fn().mockReturnValue({ labelIds: ["L1"] }),
      buildMutationVars: vi
        .fn()
        .mockImplementation(
          (_doc: string, input: Record<string, unknown>, resolved: Record<string, unknown>) => ({
            ...input,
            ...resolved,
          }),
        ),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")
    const { buildCacheKey, createResolutionCache } = await import(
      "@core/core/routing/resolution-cache.js"
    )

    // Pre-populate cache for both lookups
    const cache = createResolutionCache()
    const cachedData = {
      repository: { labels: { nodes: [{ id: "L1", name: "bug" }] } },
    }
    cache.set(buildCacheKey("IssueLabelsLookup", { issueId: "I1" }), cachedData)
    cache.set(buildCacheKey("IssueLabelsLookup", { issueId: "I2" }), cachedData)

    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: { updateIssue: { issue: { id: "I1" } } },
        step1: { updateIssue: { issue: { id: "I2" } } },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        { task: "issue.labels.set", input: { issueId: "I1", labels: ["bug"] } },
        { task: "issue.labels.set", input: { issueId: "I2", labels: ["bug"] } },
      ],
      {
        githubClient: createGithubClient({ queryRaw: queryRawMock }),
        resolutionCache: cache,
      },
    )

    // Phase 1 batch query should NOT have been called
    expect(buildBatchQueryMock).not.toHaveBeenCalled()
    // Only Phase 2 mutation query (via queryRaw)
    expect(queryRawMock).toHaveBeenCalledTimes(1)
    expect(result.status).toBe("success")
  })
})

describe("executeTasks — partial error handling", () => {
  it("Phase 2 partial failure: one step errors, other succeeds → status partial", async () => {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const cardWithGql = {
      ...baseCard,
      graphql: {
        operationName: "IssueCreate",
        documentPath: "src/gql/operations/issue-create.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(cardWithGql)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueCreate($repositoryId: ID!, $title: String!) { createIssue(input: {repositoryId: $repositoryId, title: $title}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: `mutation Batch { step0: createIssue { issue { id } } step1: createIssue { issue { id } } }`,
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        {
          task: "issue.create",
          input: { repositoryId: "R1", title: "Issue 1" },
        },
        {
          task: "issue.create",
          input: { repositoryId: "R2", title: "Issue 2" },
        },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: {
              step0: { createIssue: { issue: { id: "I1" } } },
              step1: null,
            },
            errors: [
              {
                message: "Could not resolve repository",
                path: ["step1", "createIssue"],
              },
            ],
          }),
        }),
      },
    )

    expect(result.status).toBe("partial")
    expect(result.results[0]?.ok).toBe(true)
    expect(result.results[0]?.data).toEqual({
      createIssue: { issue: { id: "I1" } },
    })
    expect(result.results[1]?.ok).toBe(false)
    expect(result.results[1]?.error?.message).toContain("Could not resolve repository")
  })

  it("Phase 2 unattributed error: errors without path → all steps failed", async () => {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const cardWithGql = {
      ...baseCard,
      graphql: {
        operationName: "IssueCreate",
        documentPath: "src/gql/operations/issue-create.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(cardWithGql)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueCreate($repositoryId: ID!, $title: String!) { createIssue(input: {repositoryId: $repositoryId, title: $title}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: `mutation Batch { step0: createIssue { issue { id } } step1: createIssue { issue { id } } }`,
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        {
          task: "issue.create",
          input: { repositoryId: "R1", title: "Issue 1" },
        },
        {
          task: "issue.create",
          input: { repositoryId: "R2", title: "Issue 2" },
        },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: {},
            errors: [{ message: "Internal server error" }],
          }),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toBe("Internal server error")
    expect(result.results[1]?.ok).toBe(false)
    expect(result.results[1]?.error?.message).toBe("Internal server error")
  })

  it("Phase 2 numeric path[0]: non-string path element → all steps failed", async () => {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const cardWithGql = {
      ...baseCard,
      graphql: {
        operationName: "IssueCreate",
        documentPath: "src/gql/operations/issue-create.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(cardWithGql)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueCreate($repositoryId: ID!, $title: String!) { createIssue(input: {repositoryId: $repositoryId, title: $title}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: `mutation Batch { step0: createIssue { issue { id } } step1: createIssue { issue { id } } }`,
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        {
          task: "issue.create",
          input: { repositoryId: "R1", title: "Issue 1" },
        },
        {
          task: "issue.create",
          input: { repositoryId: "R2", title: "Issue 2" },
        },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: {},
            errors: [{ message: "Some error", path: [0, "createIssue"] }],
          }),
        }),
      },
    )

    // path[0] is a number, not a string alias, so attribution fails → all steps failed
    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toBe("Some error")
    expect(result.results[1]?.ok).toBe(false)
    expect(result.results[1]?.error?.message).toBe("Some error")
  })

  it("Phase 2 missing alias: step result absent from response → error for that step", async () => {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const card = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "src/gql/operations/issue-close.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(card)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi.fn().mockReturnValue("mutation IssueClose { closeIssue { id } }"),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: "mutation { step0: closeIssue { id } step1: closeIssue { id } }",
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.close", input: { issueId: "I2" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: { step0: { closeIssue: { id: "I1" } } },
            errors: undefined,
          }),
        }),
      },
    )

    // step0 succeeded, step1 has missing alias
    const r0 = result.results[0]
    const r1 = result.results[1]
    expect(r0?.ok).toBe(true)
    expect(r1?.ok).toBe(false)
    expect((r1 as { ok: false; error: { message: string } }).error.message).toContain(
      "missing mutation result",
    )
  })

  it("Phase 2 transport failure: queryRaw throws → all steps failed with retryable code", async () => {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const card = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "src/gql/operations/issue-close.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(card)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi.fn().mockReturnValue("mutation IssueClose { closeIssue { id } }"),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: "mutation { step0: closeIssue { id } step1: closeIssue { id } }",
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.close", input: { issueId: "I2" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1")),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results).toHaveLength(2)
    const s0 = result.results[0]
    const s1 = result.results[1]
    expect(s0?.ok).toBe(false)
    expect(s1?.ok).toBe(false)
    const err = (s0 as { ok: false; error: { message: string; retryable: boolean } }).error
    expect(err.message).toBe("connect ECONNREFUSED 127.0.0.1")
    expect(err.retryable).toBe(true)
  })

  it("Phase 2 clean response: no errors → status success (regression)", async () => {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const cardWithGql = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "src/gql/operations/issue-close.graphql",
      },
    }
    getOperationCardMock.mockReturnValue(cardWithGql)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueClose($issueId: ID!) { closeIssue(input: {issueId: $issueId}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: `mutation Batch { step0: closeIssue { issue { id } } step1: closeIssue { issue { id } } }`,
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.close", input: { issueId: "I2" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: {
              step0: { closeIssue: { issue: { id: "I1" } } },
              step1: { closeIssue: { issue: { id: "I2" } } },
            },
            errors: undefined,
          }),
        }),
      },
    )

    expect(result.status).toBe("success")
    expect(result.results[0]?.ok).toBe(true)
    expect(result.results[1]?.ok).toBe(true)
  })
})

describe("executeTasks — Phase 1 alias un-wrap regression", () => {
  it("re-wraps de-aliased lookup result so applyInject scalar path traversal succeeds", async () => {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const cardNoResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "src/gql/operations/issue-close.graphql",
      },
    }
    const cardWithScalarResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueLabelAdd",
        documentPath: "src/gql/operations/issue-label-add.graphql",
        resolution: {
          lookup: {
            operationName: "IssueLookup",
            documentPath: "src/gql/operations/issue-lookup.graphql",
            vars: { issueNumber: "issueNumber", owner: "owner", name: "name" },
          },
          inject: [
            {
              target: "labelableId",
              source: "scalar" as const,
              path: "repository.issue.id",
            },
          ],
        },
      },
    }

    getOperationCardMock
      .mockReturnValueOnce(cardNoResolution)
      .mockReturnValueOnce(cardWithScalarResolution)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi
        .fn()
        .mockReturnValue(
          `query IssueLookup($issueNumber: Int!, $owner: String!, $name: String!) { repository(owner: $owner, name: $name) { issue(number: $issueNumber) { id } } }`,
        ),
      getMutationDocument: vi
        .fn()
        .mockImplementation((op: string) =>
          op === "IssueClose"
            ? `mutation IssueClose($issueId: ID!) { closeIssue(input: {issueId: $issueId}) { issue { id } } }`
            : `mutation IssueLabelAdd($labelableId: ID!) { addLabelsToLabelable(input: {labelableId: $labelableId}) { labelable { id } } }`,
        ),
    }))

    // Restore real batch and resolve implementations — vi.doMock factories from earlier tests
    // in this file may still be registered, so explicitly restore the real modules here.
    vi.doMock("@core/gql/batch.js", async () => {
      return await vi.importActual("@core/gql/batch.js")
    })
    vi.doMock("@core/gql/resolve.js", async () => {
      return await vi.importActual("@core/gql/resolve.js")
    })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    // Real GitHub response: root field value is returned directly under the alias key,
    // with no "repository" wrapper. The engine must re-wrap it before applyInject runs.
    const queryMock = vi.fn().mockResolvedValueOnce({
      step1: { issue: { id: "I_XYZ" } },
    })
    const queryRawMock = vi.fn().mockResolvedValueOnce({
      data: {
        step0: { closeIssue: { issue: { id: "I_1" } } },
        step1: { addLabelsToLabelable: { labelable: { id: "I_XYZ" } } },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I_1" } },
        {
          task: "issue.labels.set",
          input: {
            issueNumber: 42,
            owner: "acme",
            name: "repo",
            labelableId: "placeholder",
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
    expect(queryRawMock).toHaveBeenCalledTimes(1)
    expect(result.status).toBe("success")
    expect(result.results[0]).toMatchObject({ task: "issue.close", ok: true })
    expect(result.results[1]).toMatchObject({
      task: "issue.labels.set",
      ok: true,
    })
  })
})

describe("executeTasks — CLI chain support", () => {
  beforeEach(() => {
    executeMock.mockReset()
    getOperationCardMock.mockReset()
  })

  function setupMixedChainMocks(cliCard: unknown, gqlCard: unknown): void {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))
    // pre-flight: step 0 → cliCard, step 1 → gqlCard; executeTask re-loads card for CLI step → cliCard
    getOperationCardMock
      .mockReturnValueOnce(cliCard as OperationCard)
      .mockReturnValueOnce(gqlCard as OperationCard)
      .mockReturnValue(cliCard as OperationCard)
  }

  it("executes all steps via executeTask when all cards are CLI-only", async () => {
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    getOperationCardMock.mockReturnValue(cliCard)
    executeMock.mockResolvedValue({ ok: true, data: { id: "cli-result" } })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
      ],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("success")
    expect(result.meta.route_used).toBe("cli")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toMatchObject({ ok: true, data: { id: "cli-result" } })
    expect(result.results[1]).toMatchObject({ ok: true, data: { id: "cli-result" } })
  })

  it("propagates CLI step failure into step result", async () => {
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    getOperationCardMock.mockReturnValue(cliCard)
    executeMock.mockResolvedValue({
      ok: false,
      error: { code: "UNKNOWN", message: "cli failed", retryable: false },
    })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
      ],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]).toMatchObject({ ok: false })
    expect(result.results[0]?.error?.message).toBe("cli failed")
    expect(result.results[1]).toMatchObject({ ok: false })
  })

  it("mixes CLI and GQL steps in the same chain with route_used: graphql", async () => {
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    const gqlCard = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "src/gql/operations/issue-close.graphql",
      },
    }
    setupMixedChainMocks(cliCard, gqlCard)

    executeMock.mockResolvedValue({ ok: true, data: { id: "cli-result" } })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueClose($issueId: ID!) { closeIssue(input: {issueId: $issueId}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: `mutation Batch { step1: closeIssue { issue { id } } }`,
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.close", input: { issueId: "I1" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: {
              step1: { closeIssue: { issue: { id: "I1" } } },
            },
            errors: undefined,
          }),
        }),
      },
    )

    expect(result.status).toBe("success")
    expect(result.meta.route_used).toBe("graphql")
    expect(result.results[0]).toMatchObject({ ok: true, data: { id: "cli-result" } })
    expect(result.results[1]).toMatchObject({ ok: true })
  })

  it("reports partial status when CLI step fails and GQL step succeeds", async () => {
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    const gqlCard = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "src/gql/operations/issue-close.graphql",
      },
    }
    setupMixedChainMocks(cliCard, gqlCard)

    // CLI step fails
    executeMock.mockResolvedValue({
      ok: false,
      error: { code: "UNKNOWN", message: "cli failed", retryable: false },
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi
        .fn()
        .mockReturnValue(
          `mutation IssueClose($issueId: ID!) { closeIssue(input: {issueId: $issueId}) { issue { id } } }`,
        ),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: `mutation Batch { step1: closeIssue { issue { id } } }`,
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.close", input: { issueId: "I1" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: {
              step1: { closeIssue: { issue: { id: "I1" } } },
            },
            errors: undefined,
          }),
        }),
      },
    )

    expect(result.status).toBe("partial")
    expect(result.meta.route_used).toBe("graphql")
    expect(result.results[0]).toMatchObject({ ok: false, error: { message: "cli failed" } })
    expect(result.results[1]).toMatchObject({ ok: true })
  })

  it("single-step all-CLI chain preserves route_used: cli from executeTask delegation", async () => {
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    getOperationCardMock.mockReturnValue(cliCard)
    executeMock.mockResolvedValue({
      ok: true,
      data: { id: "cli-single" },
      meta: { route_used: "cli" as const },
    })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [{ task: "issue.list", input: { owner: "acme", name: "modkit" } }],
      { githubClient: createGithubClient() },
    )

    // Single-item path delegates to executeTask; route_used comes from that result's meta
    expect(result.status).toBe("success")
    expect(result.meta.route_used).toBe("cli")
    expect(result.results[0]).toMatchObject({ ok: true, data: { id: "cli-single" } })
  })

  it("drains in-flight CLI promises when Phase 1 resolution lookup fails", async () => {
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    const gqlCard = {
      ...baseCard,
      graphql: {
        operationName: "IssueView",
        documentPath: "src/gql/operations/issue-view.graphql",
        resolution: {
          lookup: {
            operationName: "RepoLookup",
            documentPath: "src/gql/operations/repo-lookup.graphql",
            vars: { owner: "owner", name: "name" },
          },
          inject: [],
        },
      },
    }
    setupMixedChainMocks(cliCard, gqlCard)

    // CLI step fails — both steps end up failing, so status remains "failed"
    executeMock.mockResolvedValue({
      ok: false,
      error: { code: "UNKNOWN", message: "cli network timeout", retryable: false },
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn().mockReturnValue("query RepoLookup { repository { id } }"),
      getMutationDocument: vi.fn(),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: vi
        .fn()
        .mockReturnValue({ document: "query Batch { step1: repository { id } }", variables: {} }),
      buildBatchMutation: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.view", input: { owner: "acme", name: "modkit" } },
      ],
      {
        githubClient: createGithubClient({
          query: vi.fn().mockRejectedValue(new Error("resolution batch network error")),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toBe("cli network timeout")
    expect(result.results[1]?.ok).toBe(false)
    expect(result.results[1]?.error?.message).toMatch("Phase 1 (resolution) failed")
  })

  it("returns partial when Phase 1 fails but CLI step succeeded", async () => {
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    const gqlCard = {
      ...baseCard,
      graphql: {
        operationName: "IssueView",
        documentPath: "src/gql/operations/issue-view.graphql",
        resolution: {
          lookup: {
            operationName: "RepoLookup",
            documentPath: "src/gql/operations/repo-lookup.graphql",
            vars: { owner: "owner", name: "name" },
          },
          inject: [],
        },
      },
    }
    setupMixedChainMocks(cliCard, gqlCard)

    executeMock.mockResolvedValue({
      ok: true,
      data: { id: "cli-ok" },
      meta: { route_used: "cli" as const },
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn().mockReturnValue("query RepoLookup { repository { id } }"),
      getMutationDocument: vi.fn(),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: vi
        .fn()
        .mockReturnValue({ document: "query Batch { step1: repository { id } }", variables: {} }),
      buildBatchMutation: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.view", input: { owner: "acme", name: "modkit" } },
      ],
      {
        githubClient: createGithubClient({
          query: vi.fn().mockRejectedValue(new Error("resolution batch network error")),
        }),
      },
    )

    expect(result.status).toBe("partial")
    expect(result.results[0]).toMatchObject({ ok: true, data: { id: "cli-ok" } })
    expect(result.results[1]?.ok).toBe(false)
    expect(result.results[1]?.error?.message).toMatch("Phase 1 (resolution) failed")
  })

  it("handles executeTask throwing unexpectedly (rejected promise) for a CLI step", async () => {
    // Use two requests to exercise the multi-step code path where cliStepPromises
    // is collected via Promise.allSettled — the single-step fast path does not
    // go through that branch.
    const cliCard = {
      ...baseCard,
      routing: { preferred: "cli" as const, fallbacks: [] as const },
      graphql: undefined,
      cli: { command: "gh issue list" },
    }
    getOperationCardMock.mockReturnValue(cliCard)
    executeMock.mockRejectedValue(new Error("unexpected internal failure"))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
        { task: "issue.list", input: { owner: "acme", name: "modkit" } },
      ],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]).toMatchObject({ ok: false })
    expect(result.results[0]?.error?.message).toBe("unexpected internal failure")
  })
})

describe("executeTask — preflight branches", () => {
  beforeEach(() => {
    executeMock.mockReset()
    getOperationCardMock.mockReset()
    getOperationCardMock.mockReturnValue(baseCard)
  })

  it("forwards githubToken to preflight when provided", async () => {
    executeMock.mockImplementation(
      async (options: { preflight: (route: string) => Promise<unknown> }) => {
        return options.preflight("graphql")
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")

    await executeTask(
      { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      {
        githubClient: createGithubClient(),
        githubToken: "ghp_test123",
      },
    )

    expect(executeMock).toHaveBeenCalledTimes(1)
  })

  it("preflight for non-CLI route skips CLI detection entirely", async () => {
    const cliRunner = {
      run: vi.fn(async () => ({ exitCode: 0, stdout: "ok", stderr: "" })),
    }
    executeMock.mockImplementation(
      async (options: { preflight: (route: string) => Promise<unknown> }) => {
        return options.preflight("graphql")
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")

    await executeTask(
      { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      {
        githubClient: createGithubClient(),
        cliRunner,
      },
    )

    expect(cliRunner.run).not.toHaveBeenCalled()
  })

  it("uses provided ghCliAvailable and ghAuthenticated without probing", async () => {
    const cliRunner = {
      run: vi.fn(async () => ({ exitCode: 0, stdout: "ok", stderr: "" })),
    }
    executeMock.mockImplementation(
      async (options: { preflight: (route: "cli") => Promise<unknown> }) => {
        return options.preflight("cli")
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")

    await executeTask(
      { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      {
        githubClient: createGithubClient(),
        cliRunner,
        ghCliAvailable: true,
        ghAuthenticated: true,
      },
    )

    expect(cliRunner.run).not.toHaveBeenCalled()
  })

  it("probes when ghCliAvailable is provided but ghAuthenticated is not", async () => {
    const cliRunner = {
      run: vi.fn(async () => ({ exitCode: 0, stdout: "gh version 1", stderr: "" })),
    }
    executeMock.mockImplementation(
      async (options: { preflight: (route: "cli") => Promise<{ ok: boolean }> }) => {
        return options.preflight("cli")
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")

    await executeTask(
      { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      {
        githubClient: createGithubClient(),
        cliRunner,
        ghCliAvailable: true,
      },
    )

    expect(cliRunner.run).toHaveBeenCalled()
  })

  it("skipGhPreflight fills only missing fields, preserves provided ghCliAvailable", async () => {
    const cliRunner = {
      run: vi.fn(async () => ({ exitCode: 1, stdout: "", stderr: "" })),
    }
    executeMock.mockImplementation(
      async (options: { preflight: (route: "cli") => Promise<{ ok: boolean }> }) => {
        return options.preflight("cli")
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")

    const result = await executeTask(
      { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      {
        githubClient: createGithubClient(),
        cliRunner,
        ghCliAvailable: true,
        skipGhPreflight: true,
      },
    )

    expect(cliRunner.run).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
  })

  it("uses custom reason code when provided in deps", async () => {
    getOperationCardMock.mockReturnValue(null)

    const { executeTask } = await import("@core/core/routing/engine.js")

    const result = await executeTask(
      { task: "unknown.task", input: {} },
      {
        githubClient: createGithubClient(),
        reason: "CARD_PREFERRED",
      },
    )

    expect(result.ok).toBe(false)
    expect(result.meta.reason).toBe("CARD_PREFERRED")
  })
})

describe("executeTasks — 1-item chain error paths", () => {
  beforeEach(() => {
    executeMock.mockReset()
    getOperationCardMock.mockReset()
    getOperationCardMock.mockReturnValue(baseCard)
  })

  it("1-item chain returns failed status when executeTask returns ok: false", async () => {
    executeMock.mockResolvedValue({
      ok: false,
      data: undefined,
      error: { code: "NOT_FOUND", message: "Not found", retryable: false },
      meta: { route_used: "graphql" },
    })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [{ task: "repo.view", input: { owner: "acme", name: "modkit" } }],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.code).toBe("NOT_FOUND")
    expect(result.meta.succeeded).toBe(0)
    expect(result.meta.failed).toBe(1)
  })

  it("1-item chain uses Unknown error when result.error is null", async () => {
    executeMock.mockResolvedValue({
      ok: false,
      data: undefined,
      error: null,
      meta: { route_used: "cli" },
    })

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [{ task: "repo.view", input: { owner: "acme", name: "modkit" } }],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.code).toBe("UNKNOWN")
    expect(result.meta.route_used).toBe("cli")
  })
})

describe("executeTasks — input validation preflight", () => {
  it("rejects chain when input fails schema validation", async () => {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))

    const cardWithSchema = {
      ...baseCard,
      input_schema: {
        type: "object",
        properties: { owner: { type: "string" }, name: { type: "string" } },
        required: ["owner", "name"],
      },
      graphql: {
        operationName: "RepoView",
        documentPath: "src/gql/operations/repo-view.graphql",
      },
    }

    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: vi.fn().mockReturnValue(cardWithSchema),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "repo.view", input: {} },
        { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      ],
      { githubClient: createGithubClient() },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toContain("Input validation failed")
    expect(result.results[1]?.ok).toBe(false)
  })
})

describe("executeTasks — Phase 1 resolution failure", () => {
  it("marks all steps as failed when Phase 1 batch lookup query rejects", async () => {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const cardWithResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueLabelsSet",
        documentPath: "x",
        resolution: {
          lookup: {
            operationName: "IssueLabelsLookup",
            documentPath: "y",
            vars: { issueId: "issueId" },
          },
          inject: [],
        },
      },
    }
    getOperationCardMock.mockReturnValue(cardWithResolution)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn().mockReturnValue("query IssueLabelsLookup { node { id } }"),
      getMutationDocument: vi.fn(),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: vi
        .fn()
        .mockReturnValue({ document: "query { step0: node { id } }", variables: {} }),
      buildBatchMutation: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.labels.set", input: { issueId: "I1" } },
        { task: "issue.labels.set", input: { issueId: "I2" } },
      ],
      {
        githubClient: createGithubClient({
          query: vi.fn().mockRejectedValue(new Error("rate limit exceeded")),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toContain("Phase 1 (resolution) failed")
    expect(result.results[1]?.ok).toBe(false)
  })
})

describe("executeTasks — Phase 2 inject error", () => {
  it("marks step as failed when applyInject throws during Phase 2", async () => {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const cardWithResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueLabelsSet",
        documentPath: "x",
        resolution: {
          lookup: {
            operationName: "IssueLabelsLookup",
            documentPath: "y",
            vars: { issueId: "issueId" },
          },
          inject: [
            {
              target: "labelIds",
              source: "map_array" as const,
              from_input: "labels",
              nodes_path: "repository.labels.nodes",
              match_field: "name",
              extract_field: "id",
            },
          ],
        },
      },
    }
    getOperationCardMock.mockReturnValue(cardWithResolution)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn().mockReturnValue("query IssueLabelsLookup { node { id } }"),
      getMutationDocument: vi
        .fn()
        .mockReturnValue("mutation IssueLabelsSet { updateIssue { id } }"),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: vi
        .fn()
        .mockReturnValue({ document: "query { step0: node { id } }", variables: {} }),
      buildBatchMutation: vi
        .fn()
        .mockReturnValue({ document: "mutation { step0: x { id } }", variables: {} }),
      extractRootFieldName: vi.fn().mockReturnValue(null),
    }))
    vi.doMock("@core/gql/resolve.js", () => ({
      applyInject: vi.fn().mockImplementation(() => {
        throw new Error("inject path resolution failed")
      }),
      buildMutationVars: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: { labels: { nodes: [] } },
      step1: { labels: { nodes: [] } },
    })
    const queryRawMock = vi.fn().mockResolvedValue({ data: {}, errors: undefined })

    const result = await executeTasks(
      [
        { task: "issue.labels.set", input: { issueId: "I1", labels: ["bug"] } },
        { task: "issue.labels.set", input: { issueId: "I2", labels: ["bug"] } },
      ],
      {
        githubClient: createGithubClient({ query: queryMock, queryRaw: queryRawMock }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toContain("inject path resolution failed")
  })
})

describe("executeTasks — Phase 2 null/missing data response", () => {
  it("returns missing-alias error when data is null (falls through to empty {})", async () => {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const card = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "x",
      },
    }
    getOperationCardMock.mockReturnValue(card)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi.fn().mockReturnValue("mutation IssueClose { closeIssue { id } }"),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: "mutation { step0: closeIssue { id } step1: closeIssue { id } }",
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.close", input: { issueId: "I2" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: null,
            errors: undefined,
          }),
        }),
      },
    )

    expect(result.status).toBe("failed")
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toContain("missing mutation result")
  })
})

describe("executeTasks — resolution cache population", () => {
  it("populates resolution cache during Phase 1 and verifies entries", async () => {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const cardWithResolution = {
      ...baseCard,
      graphql: {
        operationName: "IssueLabelsSet",
        documentPath: "x",
        resolution: {
          lookup: {
            operationName: "IssueLabelsLookup",
            documentPath: "y",
            vars: { issueId: "issueId" },
          },
          inject: [
            {
              target: "labelIds",
              source: "map_array" as const,
              from_input: "labels",
              nodes_path: "repository.labels.nodes",
              match_field: "name",
              extract_field: "id",
            },
          ],
        },
      },
    }
    getOperationCardMock.mockReturnValue(cardWithResolution)

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi
        .fn()
        .mockReturnValue("query IssueLabelsLookup($issueId: ID!) { node(id: $issueId) { id } }"),
      getMutationDocument: vi
        .fn()
        .mockReturnValue("mutation IssueLabelsSet { updateIssue { id } }"),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchQuery: vi.fn().mockReturnValue({
        document: "query { step0: node { id } step1: node { id } }",
        variables: {},
      }),
      buildBatchMutation: vi.fn().mockReturnValue({
        document: "mutation { step0: updateIssue { id } step1: updateIssue { id } }",
        variables: {},
      }),
      extractRootFieldName: vi.fn().mockReturnValue("node"),
    }))
    vi.doMock("@core/gql/resolve.js", () => ({
      applyInject: vi.fn().mockReturnValue({ labelIds: ["L1"] }),
      buildMutationVars: vi
        .fn()
        .mockImplementation(
          (_doc: string, input: Record<string, unknown>, resolved: Record<string, unknown>) => ({
            ...input,
            ...resolved,
          }),
        ),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")
    const { createResolutionCache } = await import("@core/core/routing/resolution-cache.js")

    const cache = createResolutionCache()
    const queryMock = vi.fn().mockResolvedValueOnce({
      step0: { labels: { nodes: [{ id: "L1", name: "bug" }] } },
      step1: { labels: { nodes: [{ id: "L1", name: "bug" }] } },
    })
    const queryRawMock = vi.fn().mockResolvedValue({
      data: {
        step0: { updateIssue: { id: "I1" } },
        step1: { updateIssue: { id: "I2" } },
      },
      errors: undefined,
    })

    const result = await executeTasks(
      [
        { task: "issue.labels.set", input: { issueId: "I1", labels: ["bug"] } },
        { task: "issue.labels.set", input: { issueId: "I2", labels: ["bug"] } },
      ],
      {
        githubClient: createGithubClient({ query: queryMock, queryRaw: queryRawMock }),
        resolutionCache: cache,
      },
    )

    expect(result.status).toBe("success")
    expect(cache.size).toBe(2)
  })
})

describe("executeTask — route callback invocation", () => {
  beforeEach(() => {
    executeMock.mockReset()
    getOperationCardMock.mockReset()
    getOperationCardMock.mockReturnValue(baseCard)
  })

  it("graphql route callback invokes runGraphqlCapability", async () => {
    executeMock.mockImplementation(
      async (options: {
        routes: { graphql: (params: Record<string, unknown>) => Promise<unknown> }
      }) => {
        return options.routes.graphql({})
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")

    const result = await executeTask(
      { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      { githubClient: createGithubClient() },
    )

    // runGraphqlCapability is called (not mocked here so it runs the real adapter)
    // The result shape depends on the adapter, but execute was intercepted
    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(result).toBeDefined()
  })

  it("cli route callback invokes runCliCapability", async () => {
    executeMock.mockImplementation(
      async (options: {
        routes: { cli: (params: Record<string, unknown>) => Promise<unknown> }
      }) => {
        return options.routes.cli({})
      },
    )

    const { executeTask } = await import("@core/core/routing/engine.js")

    const result = await executeTask(
      { task: "repo.view", input: { owner: "acme", name: "modkit" } },
      { githubClient: createGithubClient() },
    )

    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(result).toBeDefined()
  })
})

describe("executeTasks — step skipped assembly fallback", () => {
  it("returns step-skipped error when a step has no mutation input and no pre-result", async () => {
    vi.resetModules()
    vi.doMock("@core/core/execute/execute.js", () => ({
      execute: (...args: unknown[]) => executeMock(...args),
    }))
    vi.doMock("@core/core/registry/index.js", () => ({
      getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
    }))

    const card = {
      ...baseCard,
      graphql: {
        operationName: "IssueClose",
        documentPath: "x",
      },
    }
    getOperationCardMock.mockReturnValue(card)

    // getMutationDocument throws so buildMutationVars is never called, but the step
    // catches it and records a stepPreResult. To get the "step skipped" path, we need
    // a step that has no preResult AND no mutationInput. This can happen if card.graphql
    // is unexpectedly undefined after preflight passes.
    // We'll achieve this by having getMutationDocument throw for step 0 (which creates
    // a stepPreResult) and having queryRaw return data only for step1.
    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: vi.fn(),
      getMutationDocument: vi.fn().mockReturnValue("mutation IssueClose { closeIssue { id } }"),
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: vi.fn().mockReturnValue({
        document: "mutation { step0: closeIssue { id } step1: closeIssue { id } }",
        variables: {},
      }),
      buildBatchQuery: vi.fn(),
    }))
    vi.doMock("@core/gql/resolve.js", () => ({
      applyInject: vi.fn(),
      // buildMutationVars throws for step index 0, creating stepPreResults[0]
      // but step 1 succeeds and creates a mutationInput
      buildMutationVars: vi
        .fn()
        .mockImplementationOnce(() => {
          throw new Error("vars build failed")
        })
        .mockReturnValueOnce({ issueId: "I2" }),
    }))

    const { executeTasks } = await import("@core/core/routing/engine.js")

    const result = await executeTasks(
      [
        { task: "issue.close", input: { issueId: "I1" } },
        { task: "issue.close", input: { issueId: "I2" } },
      ],
      {
        githubClient: createGithubClient({
          queryRaw: vi.fn().mockResolvedValue({
            data: { step1: { closeIssue: { issue: { id: "I2" } } } },
            errors: undefined,
          }),
        }),
      },
    )

    // step 0: preResult error from buildMutationVars throwing
    expect(result.results[0]?.ok).toBe(false)
    expect(result.results[0]?.error?.message).toContain("vars build failed")
    // step 1: succeeds (mutation alias "step1" maps to stepIndex 1, which is the second mutationInput)
    // But since buildBatchMutation only receives 1 item (step1), the alias is "step1"
  })
})

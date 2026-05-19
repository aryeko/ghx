import type { OperationCard } from "@core/core/registry/types.js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { baseCard, createGithubClient } from "../helpers/engine-fixtures.js"

const getOperationCardMock = vi.fn()

beforeEach(() => {
  vi.resetModules()
  getOperationCardMock.mockReset()
  vi.doMock("@core/core/registry/index.js", () => ({
    getOperationCard: (...args: unknown[]) => getOperationCardMock(...args),
  }))
})

describe("executeTasks chaining — pr.close", () => {
  it("2-step pr.close chain resolves both PR node ids and batches the close mutations", async () => {
    const prCloseCard: OperationCard = {
      ...baseCard,
      capability_id: "pr.close",
      description: "Close a PR",
      input_schema: {
        type: "object",
        required: ["owner", "name", "prNumber"],
        properties: {
          owner: { type: "string", minLength: 1 },
          name: { type: "string", minLength: 1 },
          prNumber: { type: "integer", minimum: 1 },
          deleteBranch: { type: "boolean" },
        },
        additionalProperties: false,
      },
      output_schema: { type: "object" },
      routing: {
        preferred: "graphql",
        fallbacks: ["cli"],
        suitability: [
          {
            when: "params",
            predicate: "cli if deleteBranch == true",
            reason: "delete-branch requires CLI",
          },
        ],
      },
      graphql: {
        operationName: "PrClose",
        operationType: "mutation",
        documentPath: "src/gql/operations/pr-close.graphql",
        resolution: {
          lookup: {
            operationName: "PrNodeId",
            documentPath: "src/gql/operations/pr-node-id.graphql",
            vars: { owner: "owner", name: "name", prNumber: "prNumber" },
          },
          inject: [
            { target: "pullRequestId", source: "scalar", path: "repository.pullRequest.id" },
          ],
        },
      },
    }

    getOperationCardMock.mockReturnValue(prCloseCard)

    const getMutationDocumentMock = vi
      .fn()
      .mockReturnValueOnce(
        `query PrNodeId($owner: String!, $name: String!, $prNumber: Int!) { repository(owner: $owner, name: $name) { pullRequest(number: $prNumber) { id } } }`,
      )
      .mockReturnValue(
        `mutation PrClose($pullRequestId: ID!) { closePullRequest(input: {pullRequestId: $pullRequestId}) { pullRequest { id number state closed } } }`,
      )

    const buildBatchQueryMock = vi.fn().mockReturnValue({
      document: `query BatchLookup { step0: repository(owner: "acme", name: "repo") { pullRequest(number: 1) { id } } step1: repository(owner: "acme", name: "repo") { pullRequest(number: 2) { id } } }`,
      variables: {},
    })
    const buildBatchMutationMock = vi.fn().mockReturnValue({
      document: `mutation BatchComposite { step0: closePullRequest { pullRequest { id number state closed } } step1: closePullRequest { pullRequest { id number state closed } } }`,
      variables: {
        step0_pullRequestId: "PR_node_1",
        step1_pullRequestId: "PR_node_2",
      },
    })

    vi.doMock("@core/gql/document-registry.js", () => ({
      getLookupDocument: getMutationDocumentMock,
      getMutationDocument: getMutationDocumentMock,
      getDocument: getMutationDocumentMock,
    }))
    vi.doMock("@core/gql/batch.js", () => ({
      buildBatchMutation: buildBatchMutationMock,
      buildBatchQuery: buildBatchQueryMock,
      extractRootFieldName: vi.fn().mockReturnValue("repository"),
    }))

    // Phase 1: resolution uses query() — returns aliased root fields
    const queryMock = vi.fn().mockResolvedValue({
      step0: { pullRequest: { id: "PR_node_1" } },
      step1: { pullRequest: { id: "PR_node_2" } },
    })
    // Phase 2: execution uses queryRaw() — returns aliased { data, errors } envelope
    const queryRawMock = vi.fn().mockResolvedValue({
      data: {
        step0: { pullRequest: { id: "PR_node_1", number: 1, state: "CLOSED", closed: true } },
        step1: { pullRequest: { id: "PR_node_2", number: 2, state: "CLOSED", closed: true } },
      },
      errors: undefined,
    })

    const { executeTasks } = await import("@core/core/routing/engine/index.js")

    const result = await executeTasks(
      [
        { task: "pr.close", input: { owner: "acme", name: "repo", prNumber: 1 } },
        { task: "pr.close", input: { owner: "acme", name: "repo", prNumber: 2 } },
      ],
      { githubClient: createGithubClient({ query: queryMock, queryRaw: queryRawMock }) },
    )

    expect(result.status).toBe("success")
    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toMatchObject({ task: "pr.close", ok: true })
    expect(result.results[1]).toMatchObject({ task: "pr.close", ok: true })
    expect(buildBatchMutationMock).toHaveBeenCalled()
  })
})

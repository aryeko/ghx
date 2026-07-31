import type { TaskRequest } from "@core/core/contracts/task.js"
import { executeTask } from "@core/core/routing/engine/index.js"
import { createGithubClient } from "@core/gql/github-client.js"
import { describe, expect, it } from "vitest"

describe("executeTask project_v2.fields.list", () => {
  it("normalizes generated single-select options in the graphql envelope", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {
          __typename: "Query",
          organization: {
            __typename: "Organization",
            projectV2: {
              __typename: "ProjectV2",
              fields: {
                __typename: "ProjectV2FieldConfigurationConnection",
                nodes: [
                  {
                    __typename: "ProjectV2SingleSelectField",
                    id: "F_1",
                    name: "Status",
                    dataType: "SINGLE_SELECT",
                    options: [
                      {
                        __typename: "ProjectV2SingleSelectFieldOption",
                        id: "OPT_1",
                        name: "Todo",
                      },
                    ],
                  },
                ],
                pageInfo: {
                  __typename: "PageInfo",
                  hasNextPage: false,
                  endCursor: null,
                },
              },
            },
          },
        } as TData
      },
    })

    const request: TaskRequest = {
      task: "project_v2.fields.list",
      input: {
        owner: "myorg",
        projectNumber: 1,
      },
    }

    const result = await executeTask(request, {
      githubClient,
      githubToken: "test-token",
    })

    expect(result.ok).toBe(true)
    expect(result.meta.route_used).toBe("graphql")
    expect(result.data).toEqual({
      items: [
        {
          id: "F_1",
          name: "Status",
          dataType: "SINGLE_SELECT",
          options: [{ id: "OPT_1", name: "Todo" }],
        },
      ],
      pageInfo: { hasNextPage: false, endCursor: null },
    })
  })

  it("returns validation error envelope for missing projectId", async () => {
    const githubClient = createGithubClient({
      async execute<TData>(): Promise<TData> {
        return {} as TData
      },
    })

    const request: TaskRequest = {
      task: "project_v2.fields.list",
      input: {},
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
})

import type { OperationCard } from "./types.js"

type RouteConfig = OperationCard["routing"]

const CLI_FIRST_FALLBACKS = ["graphql"] as const

const repoRefSchema = {
  type: "object",
  required: ["owner", "name"],
  properties: {
    owner: { type: "string", minLength: 1 },
    name: { type: "string", minLength: 1 }
  },
  additionalProperties: false
} as const

const issueOrPrListItemSchema = {
  type: "object",
  required: ["id", "number", "title", "state", "url"],
  properties: {
    id: { type: "string", minLength: 1 },
    number: { type: "integer", minimum: 1 },
    title: { type: "string" },
    state: { type: "string" },
    url: { type: "string", minLength: 1 }
  },
  additionalProperties: false
} as const

const listPageInfoSchema = {
  type: "object",
  required: ["hasNextPage", "endCursor"],
  properties: {
    hasNextPage: { type: "boolean" },
    endCursor: { type: ["string", "null"] }
  },
  additionalProperties: false
} as const

function baseCard(
  capabilityId: string,
  description: string,
  operationName: string,
  documentPath: string,
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>,
  routing?: RouteConfig
): OperationCard {
  return {
    capability_id: capabilityId,
    version: "1.0.0",
    description,
    input_schema: inputSchema,
    output_schema: {
      ...outputSchema
    },
    routing:
      routing ?? {
        preferred: "cli",
        fallbacks: [...CLI_FIRST_FALLBACKS],
        notes: ["Prefer CLI for low-latency structured fetches when gh authentication is available."]
      },
    graphql: {
      operationName,
      documentPath
    }
  }
}

export const operationCards: OperationCard[] = [
  baseCard(
    "repo.view",
    "Fetch repository metadata.",
    "RepoView",
    "src/gql/operations/repo-view.graphql",
    repoRefSchema,
    {
      type: "object",
      required: ["id", "name", "nameWithOwner", "isPrivate", "url", "defaultBranch"],
      properties: {
        id: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        nameWithOwner: { type: "string", minLength: 1 },
        isPrivate: { type: "boolean" },
        stargazerCount: { type: "integer", minimum: 0 },
        forkCount: { type: "integer", minimum: 0 },
        url: { type: "string", minLength: 1 },
        defaultBranch: { type: ["string", "null"] }
      },
      additionalProperties: false
    }
  ),
  baseCard(
    "issue.view",
    "Fetch one issue by number.",
    "IssueView",
    "src/gql/operations/issue-view.graphql",
    {
      type: "object",
      required: ["owner", "name", "issueNumber"],
      properties: {
        owner: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        issueNumber: { type: "integer", minimum: 1 }
      },
      additionalProperties: false
    },
    {
      type: "object",
      required: ["id", "number", "title", "state", "url"],
      properties: {
        id: { type: "string", minLength: 1 },
        number: { type: "integer", minimum: 1 },
        title: { type: "string" },
        state: { type: "string" },
        url: { type: "string", minLength: 1 }
      },
      additionalProperties: false
    }
  ),
  baseCard(
    "issue.list",
    "List repository issues.",
    "IssueList",
    "src/gql/operations/issue-list.graphql",
    {
      type: "object",
      required: ["owner", "name"],
      properties: {
        owner: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        state: { type: "string", minLength: 1 },
        first: { type: "integer", minimum: 1 },
        after: { type: ["string", "null"] }
      },
      additionalProperties: false
    },
    {
      type: "object",
      required: ["items", "pageInfo"],
      properties: {
        items: {
          type: "array",
          items: issueOrPrListItemSchema
        },
        pageInfo: listPageInfoSchema
      },
      additionalProperties: false
    }
  ),
  baseCard(
    "issue.comments.list",
    "List comments for one issue.",
    "IssueCommentsList",
    "src/gql/operations/issue-comments-list.graphql",
    {
      type: "object",
      required: ["owner", "name", "issueNumber", "first"],
      properties: {
        owner: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        issueNumber: { type: "integer", minimum: 1 },
        first: { type: "integer", minimum: 1 },
        after: { type: ["string", "null"] }
      },
      additionalProperties: false
    },
    {
      type: "object",
      required: ["items", "pageInfo"],
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["id", "body", "authorLogin", "url", "createdAt"],
            properties: {
              id: { type: "string", minLength: 1 },
              body: { type: "string" },
              authorLogin: { type: ["string", "null"] },
              url: { type: "string", minLength: 1 },
              createdAt: { type: "string", minLength: 1 }
            },
            additionalProperties: false
          }
        },
        pageInfo: listPageInfoSchema
      },
      additionalProperties: false
    },
    {
      preferred: "graphql",
      fallbacks: ["cli"],
      notes: [
        "Prefer GraphQL for typed issue-comment pagination and stable cursor handling.",
        "CLI fallback uses gh api graphql with bounded cursor pagination for comments."
      ]
    }
  ),
  baseCard(
    "pr.view",
    "Fetch one pull request by number.",
    "PrView",
    "src/gql/operations/pr-view.graphql",
    {
      type: "object",
      required: ["owner", "name", "prNumber"],
      properties: {
        owner: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        prNumber: { type: "integer", minimum: 1 }
      },
      additionalProperties: false
    },
    {
      type: "object",
      required: ["id", "number", "title", "state", "url"],
      properties: {
        id: { type: "string", minLength: 1 },
        number: { type: "integer", minimum: 1 },
        title: { type: "string" },
        state: { type: "string" },
        url: { type: "string", minLength: 1 }
      },
      additionalProperties: false
    }
  ),
  baseCard(
    "pr.list",
    "List repository pull requests.",
    "PrList",
    "src/gql/operations/pr-list.graphql",
    {
      type: "object",
      required: ["owner", "name"],
      properties: {
        owner: { type: "string", minLength: 1 },
        name: { type: "string", minLength: 1 },
        state: { type: "string", minLength: 1 },
        first: { type: "integer", minimum: 1 },
        after: { type: ["string", "null"] }
      },
      additionalProperties: false
    },
    {
      type: "object",
      required: ["items", "pageInfo"],
      properties: {
        items: {
          type: "array",
          items: issueOrPrListItemSchema
        },
        pageInfo: listPageInfoSchema
      },
      additionalProperties: false
    }
  )
]

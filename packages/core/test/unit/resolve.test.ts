import type { InjectSpec } from "@core/core/registry/types.js"
import { applyInject, buildOperationVars } from "@core/gql/resolve.js"
import { describe, expect, it } from "vitest"

describe("applyInject", () => {
  it("scalar: extracts value at dot-path", () => {
    const lookupResult = { node: { repository: { milestone: { id: "M_456" } } } }
    const spec: InjectSpec = {
      target: "milestoneId",
      source: "scalar",
      path: "node.repository.milestone.id",
    }
    expect(applyInject(spec, lookupResult, {})).toEqual({ milestoneId: "M_456" })
  })

  it("scalar: throws when path not found", () => {
    const spec: InjectSpec = {
      target: "milestoneId",
      source: "scalar",
      path: "node.repository.milestone.id",
    }
    expect(() => applyInject(spec, {}, {})).toThrow("milestoneId")
  })

  it("map_array: maps names to ids", () => {
    const lookupResult = {
      node: {
        repository: {
          labels: {
            nodes: [
              { id: "L_1", name: "bug" },
              { id: "L_2", name: "feat" },
            ],
          },
        },
      },
    }
    const spec: InjectSpec = {
      target: "labelIds",
      source: "map_array",
      from_input: "labels",
      nodes_path: "node.repository.labels.nodes",
      match_field: "name",
      extract_field: "id",
    }
    const input = { labels: ["feat", "bug"] }
    expect(applyInject(spec, lookupResult, input)).toEqual({ labelIds: ["L_2", "L_1"] })
  })

  it("input: passes value from input field directly", () => {
    const spec: InjectSpec = {
      target: "labelableId",
      source: "input",
      from_input: "issueId",
    }
    const input = { issueId: "I_123" }
    expect(applyInject(spec, {}, input)).toEqual({ labelableId: "I_123" })
  })

  it("input: throws when input field is missing", () => {
    const spec: InjectSpec = {
      target: "labelableId",
      source: "input",
      from_input: "issueId",
    }
    expect(() => applyInject(spec, {}, {})).toThrow("labelableId")
  })

  it("map_array: throws when name not found", () => {
    const lookupResult = { node: { repository: { labels: { nodes: [] } } } }
    const spec: InjectSpec = {
      target: "labelIds",
      source: "map_array",
      from_input: "labels",
      nodes_path: "node.repository.labels.nodes",
      match_field: "name",
      extract_field: "id",
    }
    const input = { labels: ["nonexistent"] }
    expect(() => applyInject(spec, lookupResult, input)).toThrow("nonexistent")
  })

  it("map_array throws when pageInfo.hasNextPage is true", () => {
    const nodes = Array.from({ length: 100 }, (_, i) => ({
      id: `U_${i}`,
      login: `user${i}`,
    }))
    const lookupResult = {
      repository: {
        assignableUsers: {
          pageInfo: { hasNextPage: true },
          nodes,
        },
      },
    }
    const spec: InjectSpec = {
      target: "assigneeIds",
      source: "map_array",
      from_input: "assignees",
      nodes_path: "repository.assignableUsers.nodes",
      match_field: "login",
      extract_field: "id",
    }
    const input = { assignees: ["user1"] }
    expect(() => applyInject(spec, lookupResult, input)).toThrow(
      "lookup returned 100 items but more exist",
    )
  })

  it("map_array succeeds when pageInfo.hasNextPage is false", () => {
    const lookupResult = {
      repository: {
        assignableUsers: {
          pageInfo: { hasNextPage: false },
          nodes: [{ login: "user1", id: "U_abc" }],
        },
      },
    }
    const spec: InjectSpec = {
      target: "assigneeIds",
      source: "map_array",
      from_input: "assignees",
      nodes_path: "repository.assignableUsers.nodes",
      match_field: "login",
      extract_field: "id",
    }
    const input = { assignees: ["user1"] }
    expect(applyInject(spec, lookupResult, input)).toEqual({ assigneeIds: ["U_abc"] })
  })

  it("null_literal: returns target set to null", () => {
    const spec: InjectSpec = {
      target: "milestoneId",
      source: "null_literal",
    }
    expect(applyInject(spec, {}, {})).toEqual({ milestoneId: null })
  })

  describe("input_upper", () => {
    const spec: InjectSpec = {
      target: "mergeMethod",
      source: "input_upper",
      from_input: "method",
    }

    it("uppercases a lowercase string input", () => {
      expect(applyInject(spec, {}, { method: "squash" })).toEqual({ mergeMethod: "SQUASH" })
    })

    it("uppercases a mixed-case string input", () => {
      expect(applyInject(spec, {}, { method: "Rebase" })).toEqual({ mergeMethod: "REBASE" })
    })

    it("preserves an already uppercase string input", () => {
      expect(applyInject(spec, {}, { method: "MERGE" })).toEqual({ mergeMethod: "MERGE" })
    })

    it("returns {} when the input field is missing (omits the variable)", () => {
      expect(applyInject(spec, {}, {})).toEqual({})
    })

    it("returns {} when the input field is null (omits the variable)", () => {
      expect(applyInject(spec, {}, { method: null })).toEqual({})
    })

    it("throws when the input field is not a string", () => {
      expect(() => applyInject(spec, {}, { method: 42 })).toThrow(
        /input field 'method' must be a string/,
      )
    })
  })

  it("input_present: returns true when input field exists and false otherwise", () => {
    const spec: InjectSpec = {
      target: "addComment",
      source: "input_present",
      from_input: "comment",
    }

    expect(applyInject(spec, {}, { comment: "closing note" })).toEqual({ addComment: true })
    expect(applyInject(spec, {}, {})).toEqual({ addComment: false })
  })

  it("input_default: returns input value or default when the field is absent", () => {
    const spec: InjectSpec = {
      target: "commentBody",
      source: "input_default",
      from_input: "comment",
      default: "",
    }

    expect(applyInject(spec, {}, { comment: "closing note" })).toEqual({
      commentBody: "closing note",
    })
    expect(applyInject(spec, {}, {})).toEqual({ commentBody: "" })
  })

  describe("first_scalar", () => {
    it("returns the first non-null candidate from keyed lookup results", () => {
      const spec: InjectSpec = {
        target: "projectId",
        source: "first_scalar",
        paths: [
          { from_lookup: "org", path: "organization.projectV2.id" },
          { from_lookup: "user", path: "user.projectV2.id" },
        ],
      }

      expect(
        applyInject(
          spec,
          {
            org: { organization: { projectV2: null } },
            user: { user: { projectV2: { id: "PVT_user" } } },
          },
          {},
        ),
      ).toEqual({ projectId: "PVT_user" })
    })

    it("throws when no candidate path has a value", () => {
      const spec: InjectSpec = {
        target: "projectId",
        source: "first_scalar",
        paths: [
          { from_lookup: "org", path: "organization.projectV2.id" },
          { from_lookup: "user", path: "user.projectV2.id" },
        ],
      }

      expect(() => applyInject(spec, { org: {}, user: {} }, {})).toThrow(
        "no candidate path had a value",
      )
    })
  })

  describe("draft_review_threads", () => {
    const spec: InjectSpec = {
      target: "threads",
      source: "draft_review_threads",
      from_input: "comments",
    }

    it("omits threads when comments are absent or empty", () => {
      expect(applyInject(spec, {}, {})).toEqual({})
      expect(applyInject(spec, {}, { comments: [] })).toEqual({})
    })

    it("normalizes side and startSide values", () => {
      expect(
        applyInject(
          spec,
          {},
          {
            comments: [
              {
                path: "src/a.ts",
                body: "nit",
                line: 4,
                side: "right",
                startLine: 2,
                startSide: "left",
              },
            ],
          },
        ),
      ).toEqual({
        threads: [
          {
            path: "src/a.ts",
            body: "nit",
            line: 4,
            side: "RIGHT",
            startLine: 2,
            startSide: "LEFT",
          },
        ],
      })
    })

    it("rejects malformed comments input", () => {
      expect(() => applyInject(spec, {}, { comments: "not-array" })).toThrow("is not an array")
      expect(() => applyInject(spec, {}, { comments: [null] })).toThrow("expected comment object")
      expect(() => applyInject(spec, {}, { comments: [{ side: 42 }] })).toThrow(
        "side must be a string",
      )
      expect(() => applyInject(spec, {}, { comments: [{ startSide: 42 }] })).toThrow(
        "startSide must be a string",
      )
    })
  })

  describe("project_v2_field_value", () => {
    const spec: InjectSpec = {
      target: "value",
      source: "project_v2_field_value",
    }

    it("synthesizes the selected project field value shape", () => {
      expect(applyInject(spec, {}, { clear: true })).toEqual({ value: {} })
      expect(applyInject(spec, {}, { valueText: "Ready" })).toEqual({ value: { text: "Ready" } })
      expect(applyInject(spec, {}, { valueNumber: 3 })).toEqual({ value: { number: 3 } })
      expect(applyInject(spec, {}, { valueDate: "2026-06-19" })).toEqual({
        value: { date: "2026-06-19" },
      })
      expect(applyInject(spec, {}, { valueSingleSelectOptionId: "opt-1" })).toEqual({
        value: { singleSelectOptionId: "opt-1" },
      })
      expect(applyInject(spec, {}, { valueIterationId: "iter-1" })).toEqual({
        value: { iterationId: "iter-1" },
      })
    })

    it("rejects clear combined with value fields and missing value input", () => {
      expect(() => applyInject(spec, {}, { clear: true, valueText: "Ready" })).toThrow(
        "Cannot set clear and a value field simultaneously",
      )
      expect(() => applyInject(spec, {}, {})).toThrow("At least one value field must be provided")
    })
  })
})

describe("buildOperationVars", () => {
  it("passes through vars matching mutation variable names", () => {
    const mutDoc = `mutation IssueClose($issueId: ID!) { closeIssue(input: {issueId: $issueId}) { issue { id } } }`
    const input = { issueId: "I_123", extraField: "ignored" }
    const resolved: Record<string, unknown> = {}
    const vars = buildOperationVars(mutDoc, input, resolved)
    expect(vars).toEqual({ issueId: "I_123" })
  })

  it("resolved vars override pass-through", () => {
    const mutDoc = `mutation IssueLabelsUpdate($issueId: ID!, $labelIds: [ID!]!) { updateIssue(input: {id: $issueId, labelIds: $labelIds}) { issue { id } } }`
    const input = { issueId: "I_123", labels: ["bug"] }
    const resolved = { labelIds: ["L_1"] }
    const vars = buildOperationVars(mutDoc, input, resolved)
    expect(vars).toEqual({ issueId: "I_123", labelIds: ["L_1"] })
  })

  it("maps input fields to differently named GraphQL variables", () => {
    const mutDoc = `mutation PullRequestCreate($baseRefName: String!, $headRefName: String!) { createPullRequest(input: {baseRefName: $baseRefName, headRefName: $headRefName}) { pullRequest { id } } }`
    const input = { base: "main", head: "feature" }
    const vars = buildOperationVars(mutDoc, input, {}, { baseRefName: "base", headRefName: "head" })

    expect(vars).toEqual({ baseRefName: "main", headRefName: "feature" })
  })
})

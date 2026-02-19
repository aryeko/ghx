import { buildBatchMutation, buildBatchQuery } from "@core/gql/batch.js"
import { describe, expect, it } from "vitest"

describe("buildBatchQuery", () => {
  it("wraps single query with alias", () => {
    const result = buildBatchQuery([
      {
        alias: "step0",
        query: `query IssueLabelsLookup($issueId: ID!) {
  node(id: $issueId) {
    ... on Issue { id }
  }
}`,
        variables: { issueId: "I_123" },
      },
    ])
    expect(result.document).toContain("query BatchChain")
    expect(result.document).toContain("step0:")
    expect(result.document).toContain("$step0_issueId: ID!")
    expect(result.variables).toEqual({ step0_issueId: "I_123" })
  })

  it("merges two queries", () => {
    const q = `query Foo($id: ID!) { node(id: $id) { id } }`
    const result = buildBatchQuery([
      { alias: "a", query: q, variables: { id: "1" } },
      { alias: "b", query: q, variables: { id: "2" } },
    ])
    expect(result.document).toContain("$a_id: ID!")
    expect(result.document).toContain("$b_id: ID!")
    expect(result.variables).toEqual({ a_id: "1", b_id: "2" })
  })

  it("throws on empty array", () => {
    expect(() => buildBatchQuery([])).toThrow()
  })
})

describe("buildBatchMutation", () => {
  it("wraps single mutation with alias", () => {
    const result = buildBatchMutation([
      {
        alias: "step0",
        mutation: `mutation CloseIssue($issueId: ID!) {
  closeIssue(input: {issueId: $issueId}) {
    issue { id }
  }
}`,
        variables: { issueId: "I_123" },
      },
    ])
    expect(result.document).toContain("mutation BatchComposite")
    expect(result.document).toContain("step0:")
    expect(result.variables).toEqual({ step0_issueId: "I_123" })
  })

  it("merges two mutations", () => {
    const m = `mutation UpdateIssue($issueId: ID!, $title: String!) { updateIssue(input: {id: $issueId, title: $title}) { issue { id } } }`
    const result = buildBatchMutation([
      { alias: "a", mutation: m, variables: { issueId: "I_1", title: "Title 1" } },
      { alias: "b", mutation: m, variables: { issueId: "I_2", title: "Title 2" } },
    ])
    expect(result.document).toContain("$a_issueId: ID!")
    expect(result.document).toContain("$b_title: String!")
    expect(result.variables).toEqual({
      a_issueId: "I_1",
      a_title: "Title 1",
      b_issueId: "I_2",
      b_title: "Title 2",
    })
  })

  it("throws on empty array", () => {
    expect(() => buildBatchMutation([])).toThrow()
  })
})

import { getOperationCard, listOperationCards } from "@core/core/registry/index.js"
import { validateInput, validateOutput } from "@core/core/registry/schema-validator.js"
import { describe, expect, it } from "vitest"

describe("pr.close operation card", () => {
  it("is registered in the operation card list", () => {
    const ids = listOperationCards().map((card) => card.capability_id)
    expect(ids).toContain("pr.close")
  })

  it("returns a card via getOperationCard", () => {
    const card = getOperationCard("pr.close")
    expect(card).toBeDefined()
    expect(card?.capability_id).toBe("pr.close")
  })

  it("prefers graphql with cli fallback", () => {
    const card = getOperationCard("pr.close")
    if (!card) throw new Error("missing pr.close card")
    expect(card.routing.preferred).toBe("graphql")
    expect(card.routing.fallbacks).toEqual(["cli"])
  })

  it("routes to CLI when deleteBranch is true via suitability rule", () => {
    const card = getOperationCard("pr.close")
    if (!card) throw new Error("missing pr.close card")
    expect(card.routing.suitability).toBeDefined()
    const rule = (card.routing.suitability ?? []).find((r) =>
      r.predicate.toLowerCase().includes("deletebranch"),
    )
    expect(rule).toBeDefined()
    expect(rule?.when).toBe("params")
    expect(rule?.predicate.toLowerCase()).toMatch(/cli\s+if\s+deletebranch\s*==\s*true/)
  })

  it("declares the PrClose GraphQL mutation with PrNodeId resolution", () => {
    const card = getOperationCard("pr.close")
    if (!card) throw new Error("missing pr.close card")
    expect(card.graphql?.operationName).toBe("PrClose")
    expect(card.graphql?.operationType).toBe("mutation")
    expect(card.graphql?.documentPath).toBe("src/gql/operations/pr-close.graphql")
    expect(card.graphql?.resolution?.lookup?.operationName).toBe("PrNodeId")
  })

  it("declares the gh pr close CLI command", () => {
    const card = getOperationCard("pr.close")
    if (!card) throw new Error("missing pr.close card")
    expect(card.cli?.command).toBe("pr close")
  })

  describe("input schema validation", () => {
    const card = getOperationCard("pr.close")
    const schema = (card?.input_schema ?? {}) as Record<string, unknown>

    it("accepts the minimal valid input", () => {
      const result = validateInput(schema, { owner: "acme", name: "repo", prNumber: 42 })
      expect(result.ok).toBe(true)
    })

    it("accepts deleteBranch:true", () => {
      const result = validateInput(schema, {
        owner: "acme",
        name: "repo",
        prNumber: 42,
        deleteBranch: true,
      })
      expect(result.ok).toBe(true)
    })

    it("rejects missing prNumber", () => {
      const result = validateInput(schema, { owner: "acme", name: "repo" })
      expect(result.ok).toBe(false)
    })

    it("rejects non-integer prNumber", () => {
      // AJV coerceTypes (issue #6) coerces "42" → 42; use a non-coercible string.
      const result = validateInput(schema, { owner: "acme", name: "repo", prNumber: "abc" })
      expect(result.ok).toBe(false)
    })

    it("rejects zero prNumber", () => {
      const result = validateInput(schema, { owner: "acme", name: "repo", prNumber: 0 })
      expect(result.ok).toBe(false)
    })

    it("rejects non-boolean deleteBranch", () => {
      const result = validateInput(schema, {
        owner: "acme",
        name: "repo",
        prNumber: 42,
        deleteBranch: "yes",
      })
      expect(result.ok).toBe(false)
    })

    it("accepts an optional close comment", () => {
      const result = validateInput(schema, {
        owner: "acme",
        name: "repo",
        prNumber: 42,
        comment: "Closing this PR",
      })
      expect(result.ok).toBe(true)
    })
  })

  describe("output schema validation", () => {
    const card = getOperationCard("pr.close")
    const schema = (card?.output_schema ?? {}) as Record<string, unknown>

    it("accepts the canonical success payload", () => {
      const result = validateOutput(schema, {
        prNumber: 42,
        state: "CLOSED",
        closed: true,
        deleteBranch: false,
      })
      expect(result.ok).toBe(true)
    })

    it("rejects payloads missing closed", () => {
      const result = validateOutput(schema, {
        prNumber: 42,
        state: "CLOSED",
        deleteBranch: false,
      })
      expect(result.ok).toBe(false)
    })

    it("accepts payloads missing deleteBranch", () => {
      const result = validateOutput(schema, {
        prNumber: 42,
        state: "CLOSED",
        closed: true,
      })
      expect(result.ok).toBe(true)
    })
  })
})

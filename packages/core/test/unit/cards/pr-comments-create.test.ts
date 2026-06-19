import { ajv } from "@core/core/registry/ajv-instance.js"
import { getOperationCard } from "@core/core/registry/index.js"
import { getGraphqlHandler } from "@core/gql/capability-registry.js"
import { describe, expect, it } from "vitest"

describe("pr.comments.create operation card", () => {
  it("is registered", () => {
    const card = getOperationCard("pr.comments.create")
    expect(card).toBeDefined()
  })

  it("requires owner, name, prNumber, and body in input_schema", () => {
    const card = getOperationCard("pr.comments.create")
    expect(card).toBeDefined()
    if (!card) return

    const schema = card.input_schema as {
      required?: string[]
      properties?: Record<string, unknown>
    }
    expect(schema.required).toEqual(expect.arrayContaining(["owner", "name", "prNumber", "body"]))
    expect(schema.properties?.prNumber).toBeDefined()
    expect(schema.properties?.body).toBeDefined()
  })

  it("rejects issueNumber as additional property", () => {
    const card = getOperationCard("pr.comments.create")
    expect(card).toBeDefined()
    if (!card) return

    const validate = ajv.compile(card.input_schema)
    const validInput = {
      owner: "acme",
      name: "modkit",
      prNumber: 175,
      body: "hello",
    }
    expect(validate(validInput)).toBe(true)

    const invalidInput = {
      owner: "acme",
      name: "modkit",
      prNumber: 175,
      body: "hello",
      issueNumber: 42,
    }
    expect(validate(invalidInput)).toBe(false)
  })

  it("rejects input missing prNumber", () => {
    const card = getOperationCard("pr.comments.create")
    expect(card).toBeDefined()
    if (!card) return

    const validate = ajv.compile(card.input_schema)
    expect(
      validate({
        owner: "acme",
        name: "modkit",
        body: "hello",
      }),
    ).toBe(false)
  })

  it("registers a GraphQL handler", () => {
    expect(getGraphqlHandler("pr.comments.create")).toBeDefined()
  })

  it("uses PrNodeId lookup in resolution config", () => {
    const card = getOperationCard("pr.comments.create")
    expect(card).toBeDefined()
    if (!card) return

    expect(card.graphql?.resolution).toBeDefined()
    expect(card.graphql?.resolution?.lookup?.operationName).toBe("PrNodeId")
  })
})

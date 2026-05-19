import { ajv } from "@core/core/registry/ajv-instance.js"
import { getOperationCard } from "@core/core/registry/index.js"
import { validateInput } from "@core/core/registry/schema-validator.js"
import { describe, expect, it } from "vitest"

describe("AJV integer coercion", () => {
  it("coerces a string-form integer into the integer value when the schema says integer", () => {
    const schema = {
      type: "object",
      properties: {
        n: { type: "integer", minimum: 1 },
      },
      required: ["n"],
    }

    const validate = ajv.compile(schema)
    const payload: { n: number | string } = { n: "42" }

    expect(validate(payload)).toBe(true)
    expect(payload.n).toBe(42)
    expect(typeof payload.n).toBe("number")
  })

  it("still rejects non-numeric strings against integer schemas", () => {
    const schema = {
      type: "object",
      properties: {
        n: { type: "integer", minimum: 1 },
      },
      required: ["n"],
    }

    const validate = ajv.compile(schema)
    const payload = { n: "abc" }

    expect(validate(payload)).toBe(false)
    expect(validate.errors?.[0]?.message).toMatch(/integer/i)
  })

  it("accepts a string-form jobId for workflow.job.logs.view via validateInput", () => {
    const card = getOperationCard("workflow.job.logs.view")
    expect(card).toBeDefined()
    if (!card) return

    const input: Record<string, unknown> = {
      owner: "aryeko",
      name: "ghx",
      jobId: "74276757370",
    }

    const result = validateInput(card.input_schema, input)
    expect(result.ok).toBe(true)
    expect(input.jobId).toBe(74276757370)
    expect(typeof input.jobId).toBe("number")
  })

  it("rejects a non-numeric jobId string for workflow.job.logs.view", () => {
    const card = getOperationCard("workflow.job.logs.view")
    expect(card).toBeDefined()
    if (!card) return

    const input: Record<string, unknown> = {
      owner: "aryeko",
      name: "ghx",
      jobId: "not-a-number",
    }

    const result = validateInput(card.input_schema, input)
    expect(result.ok).toBe(false)
    const messages = result.ok
      ? ""
      : result.errors.map((e) => `${e.instancePath}: ${e.message}`).join("; ")
    expect(messages).toMatch(/jobId/i)
  })
})

import { formatSchemaErrorDetails } from "@core/core/registry/schema-validator.js"
import { describe, expect, it } from "vitest"

describe("formatSchemaErrorDetails", () => {
  it("appends ` (allowed: ...)` when keyword === 'enum' and params.allowedValues is a string array", () => {
    const message = formatSchemaErrorDetails([
      {
        instancePath: "/method",
        message: "must be equal to one of the allowed values",
        keyword: "enum",
        params: { allowedValues: ["merge", "squash", "rebase"] },
      },
    ])

    expect(message).toBe(
      "/method: must be equal to one of the allowed values (allowed: merge, squash, rebase)",
    )
  })

  it("appends ` (expected: ...)` when keyword === 'type' and params.type is present", () => {
    const message = formatSchemaErrorDetails([
      {
        instancePath: "/prNumber",
        message: "must be integer",
        keyword: "type",
        params: { type: "integer" },
      },
    ])

    expect(message).toBe("/prNumber: must be integer (expected: integer)")
  })

  it("does not append any suffix for other keywords (e.g. 'required')", () => {
    const message = formatSchemaErrorDetails([
      {
        instancePath: "",
        message: "must have required property 'owner'",
        keyword: "required",
        params: { missingProperty: "owner" },
      },
    ])

    expect(message).toBe("root: must have required property 'owner'")
  })

  it("uses 'root' when instancePath is the empty string", () => {
    const message = formatSchemaErrorDetails([
      {
        instancePath: "",
        message: "must be object",
        keyword: "type",
        params: { type: "object" },
      },
    ])

    expect(message).toBe("root: must be object (expected: object)")
  })

  it("joins multiple errors with '; '", () => {
    const message = formatSchemaErrorDetails([
      {
        instancePath: "/method",
        message: "must be equal to one of the allowed values",
        keyword: "enum",
        params: { allowedValues: ["merge", "squash", "rebase"] },
      },
      {
        instancePath: "/prNumber",
        message: "must be integer",
        keyword: "type",
        params: { type: "integer" },
      },
    ])

    expect(message).toBe(
      "/method: must be equal to one of the allowed values (allowed: merge, squash, rebase); /prNumber: must be integer (expected: integer)",
    )
  })

  it("omits enum suffix when params.allowedValues is missing or not a string array", () => {
    const messageMissing = formatSchemaErrorDetails([
      {
        instancePath: "/x",
        message: "must be equal to one of the allowed values",
        keyword: "enum",
        params: {},
      },
    ])
    expect(messageMissing).toBe("/x: must be equal to one of the allowed values")

    const messageWrongType = formatSchemaErrorDetails([
      {
        instancePath: "/x",
        message: "must be equal to one of the allowed values",
        keyword: "enum",
        params: { allowedValues: [1, 2, 3] },
      },
    ])
    expect(messageWrongType).toBe("/x: must be equal to one of the allowed values")
  })

  it("omits type suffix when params.type is missing", () => {
    const message = formatSchemaErrorDetails([
      {
        instancePath: "/x",
        message: "must be a number",
        keyword: "type",
        params: {},
      },
    ])
    expect(message).toBe("/x: must be a number")
  })
})

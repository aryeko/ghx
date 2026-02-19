import {
  containsSensitiveText,
  isCheckFailureBucket,
  isCheckPassBucket,
  isCheckPendingBucket,
  parseCliData,
  parseListFirst,
  parseNonEmptyString,
  parseStrictPositiveInt,
  sanitizeCliErrorMessage,
} from "@core/core/execution/adapters/cli/helpers.js"
import { describe, expect, it } from "vitest"

describe("parseStrictPositiveInt", () => {
  it("accepts positive integers", () => expect(parseStrictPositiveInt(5)).toBe(5))
  it("rejects zero", () => expect(parseStrictPositiveInt(0)).toBeNull())
  it("rejects floats", () => expect(parseStrictPositiveInt(1.5)).toBeNull())
  it("rejects strings", () => expect(parseStrictPositiveInt("5")).toBeNull())
})

describe("parseListFirst", () => {
  it("returns DEFAULT_LIST_FIRST when undefined", () => expect(parseListFirst(undefined)).toBe(30))
  it("returns value for positive int", () => expect(parseListFirst(10)).toBe(10))
  it("returns null for zero", () => expect(parseListFirst(0)).toBeNull())
})

describe("parseNonEmptyString", () => {
  it("trims and returns non-empty strings", () => expect(parseNonEmptyString(" hi ")).toBe("hi"))
  it("returns null for empty string", () => expect(parseNonEmptyString("  ")).toBeNull())
  it("returns null for non-string", () => expect(parseNonEmptyString(5)).toBeNull())
})

describe("containsSensitiveText", () => {
  it("detects github tokens", () => expect(containsSensitiveText("ghs_abcABC123")).toBe(true))
  it("passes clean text", () => expect(containsSensitiveText("not found")).toBe(false))
})

describe("sanitizeCliErrorMessage", () => {
  it("returns trimmed stderr", () =>
    expect(sanitizeCliErrorMessage("not found", 1)).toBe("not found"))
  it("returns exit code message when stderr empty", () =>
    expect(sanitizeCliErrorMessage("", 1)).toBe("gh exited with code 1"))
  it("redacts sensitive stderr", () =>
    expect(sanitizeCliErrorMessage("ghs_secrettoken123", 1)).toBe(
      "gh command failed; stderr redacted for safety",
    ))
})

describe("parseCliData", () => {
  it("parses JSON string", () => expect(parseCliData('{"a":1}')).toEqual({ a: 1 }))
  it("returns empty object for empty string", () => expect(parseCliData("  ")).toEqual({}))
})

describe("check bucket helpers", () => {
  it("isCheckFailureBucket detects fail and cancel", () => {
    expect(isCheckFailureBucket("fail")).toBe(true)
    expect(isCheckFailureBucket("CANCEL")).toBe(true)
    expect(isCheckFailureBucket("pass")).toBe(false)
  })
  it("isCheckPassBucket detects pass", () => {
    expect(isCheckPassBucket("pass")).toBe(true)
    expect(isCheckPassBucket("fail")).toBe(false)
  })
  it("isCheckPendingBucket detects pending", () => {
    expect(isCheckPendingBucket("pending")).toBe(true)
    expect(isCheckPendingBucket("pass")).toBe(false)
  })
})

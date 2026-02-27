import { isTerminalEvent, TimeoutError } from "@eval/provider/event-listener.js"
import { describe, expect, it } from "vitest"

describe("TimeoutError", () => {
  it("creates error with correct message", () => {
    const err = new TimeoutError("ses_123", 5000)
    expect(err.message).toContain("ses_123")
    expect(err.message).toContain("5000")
    expect(err.name).toBe("TimeoutError")
    expect(err.sessionId).toBe("ses_123")
    expect(err.timeoutMs).toBe(5000)
  })

  it("is an instance of Error", () => {
    const err = new TimeoutError("ses_abc", 10000)
    expect(err).toBeInstanceOf(Error)
  })

  it("preserves sessionId and timeoutMs as properties", () => {
    const err = new TimeoutError("ses_xyz", 30000)
    expect(err.sessionId).toBe("ses_xyz")
    expect(err.timeoutMs).toBe(30000)
  })
})

describe("isTerminalEvent", () => {
  it("returns true for session.idle", () => {
    expect(isTerminalEvent({ type: "session.idle" })).toBe(true)
  })

  it("returns true for session.error", () => {
    expect(isTerminalEvent({ type: "session.error" })).toBe(true)
  })

  it("returns true for step-finish with reason=stop", () => {
    expect(isTerminalEvent({ type: "step-finish", data: { reason: "stop" } })).toBe(true)
  })

  it("returns false for step-finish without reason=stop", () => {
    expect(isTerminalEvent({ type: "step-finish", data: { reason: "tool_use" } })).toBe(false)
    expect(isTerminalEvent({ type: "step-finish" })).toBe(false)
  })

  it("returns false for non-terminal events", () => {
    expect(isTerminalEvent({ type: "message.created" })).toBe(false)
    expect(isTerminalEvent({ type: "tool.started" })).toBe(false)
  })

  it("returns false for step-finish with no data", () => {
    expect(isTerminalEvent({ type: "step-finish", data: undefined })).toBe(false)
  })

  it("returns false for step-finish with empty data", () => {
    expect(isTerminalEvent({ type: "step-finish", data: {} })).toBe(false)
  })
})

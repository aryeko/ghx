import { OpenCodeProvider } from "@eval/provider/opencode-provider.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Access private fields for inspection without modifying the class
type ProviderInternals = {
  sessionInstructions: Map<string, string>
  client: unknown
}

function internals(provider: OpenCodeProvider): ProviderInternals {
  return provider as unknown as ProviderInternals
}

function makeHandle(sessionId: string) {
  return { sessionId, provider: "opencode", createdAt: new Date().toISOString() }
}

function makeFakeClient(sessionId: string) {
  const create = vi.fn().mockResolvedValue({ id: sessionId })
  const promptAsync = vi.fn().mockResolvedValue(undefined)
  const messages = vi.fn().mockResolvedValue([
    {
      role: "assistant",
      parts: [{ type: "step-finish", reason: "stop" }],
    },
  ])

  return {
    session: { create, promptAsync, messages },
    create,
    promptAsync,
    messages,
  }
}

describe("OpenCodeProvider — sessionInstructions storage", () => {
  let provider: OpenCodeProvider

  beforeEach(() => {
    provider = new OpenCodeProvider({ port: 3001, model: "openai/gpt-4o" })
  })

  describe("createSession", () => {
    it("stores systemInstructions when provided", async () => {
      const sessionId = "ses_abc"
      const fakeClient = makeFakeClient(sessionId)
      internals(provider).client = fakeClient

      await provider.createSession({
        systemInstructions: "You are a helpful assistant.",
        scenarioId: "pr-001",
        iteration: 0,
      })

      expect(internals(provider).sessionInstructions.get(sessionId)).toBe(
        "You are a helpful assistant.",
      )
    })

    it("does not store when systemInstructions is an empty string", async () => {
      const sessionId = "ses_empty"
      const fakeClient = makeFakeClient(sessionId)
      internals(provider).client = fakeClient

      await provider.createSession({
        systemInstructions: "",
        scenarioId: "pr-002",
        iteration: 0,
      })

      expect(internals(provider).sessionInstructions.has(sessionId)).toBe(false)
    })

    it("stores instructions for multiple independent sessions", async () => {
      const fakeClient1 = makeFakeClient("ses_1")
      internals(provider).client = fakeClient1

      await provider.createSession({
        systemInstructions: "Instructions A",
        scenarioId: "pr-001",
        iteration: 0,
      })

      const fakeClient2 = makeFakeClient("ses_2")
      internals(provider).client = fakeClient2

      await provider.createSession({
        systemInstructions: "Instructions B",
        scenarioId: "pr-002",
        iteration: 0,
      })

      expect(internals(provider).sessionInstructions.get("ses_1")).toBe("Instructions A")
      expect(internals(provider).sessionInstructions.get("ses_2")).toBe("Instructions B")
    })

    it("returns a valid SessionHandle", async () => {
      const fakeClient = makeFakeClient("ses_handle")
      internals(provider).client = fakeClient

      const handle = await provider.createSession({
        systemInstructions: "any",
        scenarioId: "pr-001",
        iteration: 0,
      })

      expect(handle.sessionId).toBe("ses_handle")
      expect(handle.provider).toBe("opencode")
      expect(typeof handle.createdAt).toBe("string")
    })
  })

  describe("destroySession", () => {
    it("removes stored instructions for the destroyed session", async () => {
      const sessionId = "ses_destroy"
      internals(provider).sessionInstructions.set(sessionId, "stored instructions")

      await provider.destroySession(makeHandle(sessionId))

      expect(internals(provider).sessionInstructions.has(sessionId)).toBe(false)
    })

    it("does not affect instructions for other sessions", async () => {
      internals(provider).sessionInstructions.set("ses_keep", "keep me")
      internals(provider).sessionInstructions.set("ses_remove", "remove me")

      await provider.destroySession(makeHandle("ses_remove"))

      expect(internals(provider).sessionInstructions.has("ses_remove")).toBe(false)
      expect(internals(provider).sessionInstructions.get("ses_keep")).toBe("keep me")
    })

    it("is a no-op when session has no stored instructions", async () => {
      await expect(provider.destroySession(makeHandle("ses_nonexistent"))).resolves.toBeUndefined()
      expect(internals(provider).sessionInstructions.size).toBe(0)
    })
  })

  describe("createSession + destroySession round-trip", () => {
    it("stores instructions on create and removes them on destroy", async () => {
      const sessionId = "ses_round_trip"
      const fakeClient = makeFakeClient(sessionId)
      internals(provider).client = fakeClient

      const handle = await provider.createSession({
        systemInstructions: "Round-trip instructions",
        scenarioId: "pr-rt",
        iteration: 0,
      })

      expect(internals(provider).sessionInstructions.get(handle.sessionId)).toBe(
        "Round-trip instructions",
      )

      await provider.destroySession(handle)

      expect(internals(provider).sessionInstructions.has(handle.sessionId)).toBe(false)
    })
  })
})

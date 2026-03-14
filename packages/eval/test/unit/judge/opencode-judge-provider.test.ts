import { OpenCodeJudgeProvider } from "@eval/judge/opencode-judge-provider.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock the OpenCode SDK
const mockClose = vi.fn()
const mockCreate = vi.fn()
const mockPromptAsync = vi.fn()
const mockMessages = vi.fn()
const mockCreateOpencode = vi.fn()
const mockRm = vi.fn().mockResolvedValue(undefined)

vi.mock("@opencode-ai/sdk", () => ({
  createOpencode: mockCreateOpencode,
}))

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    mkdtemp: vi.fn().mockResolvedValue("/tmp/judge-opencode-mock"),
    rm: (...args: unknown[]) => mockRm(...args),
  }
})

function makeAssistantMessage(text: string, tokens = 42) {
  return {
    info: {
      role: "assistant",
      tokens: { input: 10, output: tokens, cache: { read: 0, write: 0 } },
    },
    parts: [
      { type: "text", text },
      { type: "step-finish", reason: "stop" },
    ],
  }
}

function setupSdkMock(sessionId = "judge-session-1", responseText = "Score: 8/10") {
  mockCreate.mockResolvedValue({ data: { id: sessionId } })
  mockPromptAsync.mockResolvedValue(undefined)
  mockMessages.mockResolvedValue({
    data: [makeAssistantMessage(responseText)],
  })
  mockCreateOpencode.mockResolvedValue({
    server: { close: mockClose },
    client: {
      session: {
        create: mockCreate,
        promptAsync: mockPromptAsync,
        messages: mockMessages,
      },
    },
  })
}

describe("OpenCodeJudgeProvider", () => {
  let provider: OpenCodeJudgeProvider

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new OpenCodeJudgeProvider({ model: "openai/gpt-4o-mini", port: 1339 })
  })

  describe("id property", () => {
    it("returns the provider name", () => {
      expect(provider.id).toBe("opencode-judge")
    })
  })

  describe("init()", () => {
    it("calls createOpencode with judge-specific config", async () => {
      setupSdkMock()

      await provider.init()

      expect(mockCreateOpencode).toHaveBeenCalledOnce()
      const callArg = mockCreateOpencode.mock.calls[0]?.[0] as Record<string, unknown>
      expect(callArg["port"]).toBe(1339)
      const config = callArg["config"] as Record<string, unknown>
      expect(config["model"]).toBe("openai/gpt-4o-mini")
      const permission = config["permission"] as Record<string, unknown>
      expect(permission["edit"]).toBe("deny")
      expect(permission["bash"]).toBe("deny")
      expect(permission["webfetch"]).toBe("deny")
    })

    it("uses default port 1339 when not specified", async () => {
      setupSdkMock()
      const providerDefault = new OpenCodeJudgeProvider({ model: "openai/gpt-4o-mini" })
      await providerDefault.init()

      const callArg = mockCreateOpencode.mock.calls[0]?.[0] as Record<string, unknown>
      expect(callArg["port"]).toBe(1339)

      await providerDefault.shutdown()
    })

    it("uses custom port when specified", async () => {
      setupSdkMock()
      const providerCustom = new OpenCodeJudgeProvider({ model: "openai/gpt-4o-mini", port: 9999 })
      await providerCustom.init()

      const callArg = mockCreateOpencode.mock.calls[0]?.[0] as Record<string, unknown>
      expect(callArg["port"]).toBe(9999)

      await providerCustom.shutdown()
    })

    it("cleans up env and config dir when createOpencode throws", async () => {
      const initError = new Error("port conflict")
      mockCreateOpencode.mockRejectedValue(initError)

      await expect(provider.init()).rejects.toThrow("port conflict")

      expect(mockRm).toHaveBeenCalledWith("/tmp/judge-opencode-mock", {
        recursive: true,
        force: true,
      })
    })
  })

  describe("judge()", () => {
    beforeEach(async () => {
      setupSdkMock("judge-sess", "Score: 9/10 — excellent routing")
      await provider.init()
    })

    it("creates a session and sends the prompt with system instructions", async () => {
      const request = {
        systemPrompt: "You are an expert evaluator.",
        userPrompt: "Evaluate this output: ...",
      }

      await provider.judge(request)

      expect(mockCreate).toHaveBeenCalledOnce()
      expect(mockPromptAsync).toHaveBeenCalledOnce()

      const promptCall = mockPromptAsync.mock.calls[0]?.[0] as Record<string, unknown>
      const body = promptCall["body"] as Record<string, unknown>
      expect(body["system"]).toBe("You are an expert evaluator.")
      const parts = body["parts"] as Array<Record<string, unknown>>
      expect(parts[0]?.["type"]).toBe("text")
      expect(parts[0]?.["text"]).toBe("Evaluate this output: ...")
    })

    it("returns extracted text from the last assistant message", async () => {
      const result = await provider.judge({
        systemPrompt: "Judge this.",
        userPrompt: "Agent output here.",
      })

      expect(result.text).toBe("Score: 9/10 — excellent routing")
    })

    it("returns tokenCount from assistant message tokens", async () => {
      const result = await provider.judge({
        systemPrompt: "Judge this.",
        userPrompt: "Agent output here.",
      })

      expect(result.tokenCount).toBeGreaterThan(0)
    })

    it("throws if not initialized", async () => {
      const uninit = new OpenCodeJudgeProvider({ model: "openai/gpt-4o-mini" })

      await expect(uninit.judge({ systemPrompt: "system", userPrompt: "user" })).rejects.toThrow(
        /not initialized/i,
      )
    })
  })

  describe("shutdown()", () => {
    it("closes the server and cleans up config dir", async () => {
      setupSdkMock()
      await provider.init()

      await provider.shutdown()

      expect(mockClose).toHaveBeenCalledOnce()
      expect(mockRm).toHaveBeenCalledWith("/tmp/judge-opencode-mock", {
        recursive: true,
        force: true,
      })
    })

    it("is safe to call when not initialized", async () => {
      await expect(provider.shutdown()).resolves.toBeUndefined()
      expect(mockClose).not.toHaveBeenCalled()
    })
  })
})

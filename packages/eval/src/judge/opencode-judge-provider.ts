import type { JudgeProvider, JudgeRequest, JudgeResponse } from "@ghx-dev/agent-profiler"
import type { SessionApi } from "../provider/opencode-provider.js"
import {
  extractMessageText,
  findLastAssistantMessage,
  getSessionApi,
  isSessionComplete,
  restoreEnv,
  snapshotManagedEnv,
  unwrapSessionId,
  unwrapSessionMessages,
} from "../provider/opencode-provider.js"

export interface OpenCodeJudgeProviderOptions {
  /** Model identifier, e.g. "openai/gpt-4o-mini". */
  readonly model: string
  /** Optional TCP port for OpenCode server. Defaults to 1338. */
  readonly port?: number
}

const DEFAULT_PORT = 1338
const POLL_INTERVAL_MS = 300
const DEFAULT_TIMEOUT_MS = 120_000

/**
 * JudgeProvider implementation that drives LLM judge calls via the OpenCode SDK.
 *
 * Uses restrictive permissions (no bash, no webfetch, no edit) since the judge
 * only needs to read and respond — no tool calls required.
 *
 * Lifecycle (not on JudgeProvider interface):
 * - Call `init()` before `judge()`
 * - Call `shutdown()` when done
 */
export class OpenCodeJudgeProvider implements JudgeProvider {
  readonly id = "opencode-judge"

  private readonly model: string
  private readonly port: number
  private client: unknown = null
  private server: { close: () => void } | null = null
  private envSnapshot: ReturnType<typeof snapshotManagedEnv> | null = null

  constructor(options: OpenCodeJudgeProviderOptions) {
    this.model = options.model
    this.port = options.port ?? DEFAULT_PORT
  }

  async init(): Promise<void> {
    if (this.server !== null) {
      throw new Error(
        "OpenCodeJudgeProvider.init() called while already initialized; call shutdown() first",
      )
    }
    const { createOpencode } = await import("@opencode-ai/sdk")

    this.envSnapshot = snapshotManagedEnv([])

    const opencode = await createOpencode({
      port: this.port,
      config: {
        model: this.model,
        instructions: [],
        plugin: [],
        mcp: {},
        agent: {},
        command: {},
        permission: {
          edit: "deny",
          bash: "deny",
          webfetch: "deny",
          doom_loop: "deny",
          external_directory: "deny",
        },
      },
    })

    this.server = opencode.server as { close: () => void }
    this.client = opencode.client
  }

  async judge(request: JudgeRequest): Promise<JudgeResponse> {
    if (!this.client) {
      throw new Error("OpenCodeJudgeProvider: not initialized — call init() first")
    }

    const sessionApi = getSessionApi(this.client)

    const sessionResult = await sessionApi.create({ url: "/session" })
    const sessionId = unwrapSessionId(sessionResult)

    await sessionApi.promptAsync({
      url: "/session/{id}/prompt_async",
      path: { id: sessionId },
      body: {
        system: request.systemPrompt,
        parts: [{ type: "text", text: request.userPrompt }],
      },
    })

    const messages = await this.pollForCompletion(sessionApi, sessionId, DEFAULT_TIMEOUT_MS)

    const lastAssistant = findLastAssistantMessage(messages)
    const text = extractMessageText(lastAssistant)
    const tokenCount = extractOutputTokenCount(lastAssistant)

    return tokenCount !== undefined ? { text, tokenCount } : { text }
  }

  async shutdown(): Promise<void> {
    if (this.server) {
      this.server.close()
      this.server = null
    }
    this.client = null
    if (this.envSnapshot) {
      restoreEnv(this.envSnapshot)
      this.envSnapshot = null
    }
  }

  private async pollForCompletion(
    sessionApi: SessionApi,
    sessionId: string,
    timeoutMs: number,
  ): Promise<unknown[]> {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const rawMessages = await sessionApi.messages({
        url: "/session/{id}/message",
        path: { id: sessionId },
        query: { limit: 200 },
      })
      const messages = unwrapSessionMessages(rawMessages)
      if (isSessionComplete(messages)) {
        return messages
      }
      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }

    throw new Error(`OpenCodeJudgeProvider: session ${sessionId} timed out after ${timeoutMs}ms`)
  }
}

function extractOutputTokenCount(message: unknown): number | undefined {
  if (!message || typeof message !== "object") return undefined
  const msg = message as Record<string, unknown>
  const info = msg["info"] as Record<string, unknown> | undefined
  if (!info) return undefined
  const tokens = info["tokens"] as Record<string, unknown> | undefined
  if (!tokens) return undefined
  const output = tokens["output"]
  return typeof output === "number" ? output : undefined
}

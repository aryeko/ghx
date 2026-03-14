import type {
  CostBreakdown,
  CreateSessionParams,
  PromptResult,
  ProviderConfig,
  SessionHandle,
  SessionProvider,
  SessionTrace,
  TimingBreakdown,
  TokenBreakdown,
  ToolCallRecord,
} from "@ghx-dev/agent-profiler"
import { classifyToolCall } from "../collector/tool-classifier.js"
import { TimeoutError } from "./event-listener.js"
import { TraceBuilder } from "./trace-builder.js"

export interface OpenCodeProviderOptions {
  /** Default TCP port the OpenCode server listens on. Overridden by `ProviderConfig.port` when > 0. */
  readonly port: number
  /** Model identifier passed to OpenCode on startup, e.g. `"openai/gpt-4o"`. */
  readonly model: string
}

export type SessionApi = {
  create: (opts: Record<string, unknown>) => Promise<unknown>
  promptAsync: (opts: Record<string, unknown>) => Promise<unknown>
  messages: (opts: Record<string, unknown>) => Promise<unknown>
}

// Known env keys managed by the provider for isolated opencode runs
const MANAGED_ENV_KEYS = ["XDG_CONFIG_HOME", "OPENCODE_CONFIG_DIR", "OPENCODE_CONFIG"] as const

type ManagedEnvKey = (typeof MANAGED_ENV_KEYS)[number]

type EnvSnapshot = {
  managed: Record<ManagedEnvKey, string | undefined>
  extra: Record<string, string | undefined>
}

export function snapshotManagedEnv(extraKeys: readonly string[]): EnvSnapshot {
  const managed = {} as Record<ManagedEnvKey, string | undefined>
  for (const key of MANAGED_ENV_KEYS) {
    managed[key] = process.env[key]
  }
  const extra: Record<string, string | undefined> = {}
  for (const key of extraKeys) {
    extra[key] = process.env[key]
  }
  return { managed, extra }
}

export function restoreEnv(snapshot: EnvSnapshot): void {
  // Restore managed keys using static property access (no dynamic delete)
  if (snapshot.managed.XDG_CONFIG_HOME === undefined) {
    delete process.env.XDG_CONFIG_HOME
  } else {
    process.env.XDG_CONFIG_HOME = snapshot.managed.XDG_CONFIG_HOME
  }
  if (snapshot.managed.OPENCODE_CONFIG_DIR === undefined) {
    delete process.env.OPENCODE_CONFIG_DIR
  } else {
    process.env.OPENCODE_CONFIG_DIR = snapshot.managed.OPENCODE_CONFIG_DIR
  }
  if (snapshot.managed.OPENCODE_CONFIG === undefined) {
    delete process.env.OPENCODE_CONFIG
  } else {
    process.env.OPENCODE_CONFIG = snapshot.managed.OPENCODE_CONFIG
  }
  // Restore caller-supplied extra keys
  for (const [k, v] of Object.entries(snapshot.extra)) {
    if (v === undefined) {
      // Use Object.defineProperty to remove without dynamic delete
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete process.env[k]
    } else {
      process.env[k] = v
    }
  }
}

export function unwrapSessionMessages(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj["data"])) return obj["data"] as unknown[]
    if (Array.isArray(obj["messages"])) return obj["messages"] as unknown[]
  }
  return []
}

export function unwrapSessionId(raw: unknown): string {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>
    if (typeof obj["id"] === "string") return obj["id"]
    if (obj["data"] && typeof obj["data"] === "object") {
      const data = obj["data"] as Record<string, unknown>
      if (typeof data["id"] === "string") return data["id"]
    }
  }
  throw new Error("opencode-provider: session.create returned unexpected shape — no id found")
}

export function getSessionApi(client: unknown): SessionApi {
  const session = (client as { session?: Record<string, unknown> }).session
  if (!session) throw new Error("opencode-provider: SDK client has no session API")

  const create = session["create"]
  const promptAsync = session["promptAsync"]
  const messages = session["messages"]

  if (
    typeof create !== "function" ||
    typeof promptAsync !== "function" ||
    typeof messages !== "function"
  ) {
    throw new Error("opencode-provider: session API missing required methods")
  }

  return {
    create: (opts) =>
      (create as (this: unknown, o: Record<string, unknown>) => Promise<unknown>).call(
        session,
        opts,
      ),
    promptAsync: (opts) =>
      (promptAsync as (this: unknown, o: Record<string, unknown>) => Promise<unknown>).call(
        session,
        opts,
      ),
    messages: (opts) =>
      (messages as (this: unknown, o: Record<string, unknown>) => Promise<unknown>).call(
        session,
        opts,
      ),
  }
}

/**
 * SessionProvider implementation that drives agent sessions via the
 * OpenCode AI coding assistant SDK.
 *
 * Each session runs in an isolated temp directory (separate `XDG_CONFIG_HOME`)
 * to prevent cross-session state contamination. The provider polls for session
 * completion every 300 ms and exports a normalized {@link SessionTrace} using
 * `TraceBuilder`.
 *
 * Implements `SessionProvider` from `@ghx-dev/agent-profiler`.
 *
 * @example
 * ```typescript
 * import { OpenCodeProvider } from "@ghx-dev/eval"
 *
 * const provider = new OpenCodeProvider({ port: 3001, model: "openai/gpt-4o" })
 * await provider.init({ port: 0, environment: {}, systemInstructions: "", mcpServers: [] })
 * const handle = await provider.createSession({ scenarioId: "pr-001", mode: "ghx" })
 * const result = await provider.prompt(handle, "Fix the PR", 120_000)
 * const trace = await provider.exportSession(handle)
 * await provider.destroySession(handle)
 * await provider.shutdown()
 * ```
 */
export class OpenCodeProvider implements SessionProvider {
  readonly id = "opencode"

  private client: unknown = null
  private server: { close: () => void } | null = null
  private envSnapshot: EnvSnapshot = {
    managed: {} as Record<ManagedEnvKey, string | undefined>,
    extra: {},
  }
  private configDir = ""
  private readonly traceBuilder = new TraceBuilder()
  private readonly sessionInstructions = new Map<string, string>()

  constructor(private readonly options: OpenCodeProviderOptions) {}

  async init(config: ProviderConfig): Promise<void> {
    if (this.server !== null) {
      throw new Error(
        "OpenCodeProvider.init() called while already initialized; call shutdown() first",
      )
    }
    const { createOpencode } = await import("@opencode-ai/sdk")
    const { mkdtemp } = await import("node:fs/promises")
    const { join } = await import("node:path")
    const { tmpdir } = await import("node:os")

    this.configDir = await mkdtemp(join(tmpdir(), "eval-opencode-"))

    const extraKeys = Object.keys(config.environment)
    this.envSnapshot = snapshotManagedEnv(extraKeys)

    // Clear stale opencode config overrides
    delete process.env.OPENCODE_CONFIG
    delete process.env.OPENCODE_CONFIG_DIR

    // Apply isolated config dir
    process.env.XDG_CONFIG_HOME = this.configDir
    process.env.OPENCODE_CONFIG_DIR = this.configDir

    // Apply caller-supplied environment
    for (const [k, v] of Object.entries(config.environment)) {
      process.env[k] = v
    }

    try {
      const githubToken = process.env["GH_TOKEN"] ?? process.env["GITHUB_TOKEN"] ?? ""
      const mcp =
        config.mode === "mcp" && githubToken
          ? {
              github: {
                type: "remote" as const,
                url: "https://api.githubcopilot.com/mcp/",
                headers: { Authorization: `Bearer ${githubToken}` },
              },
            }
          : {}

      const opencode = await createOpencode({
        port: config.port > 0 ? config.port : this.options.port,
        config: {
          model: this.options.model,
          instructions: [],
          plugin: [],
          mcp,
          agent: {},
          command: {},
          permission: {
            edit: "deny",
            bash: "allow",
            webfetch: "allow",
            doom_loop: "deny",
            external_directory: "deny",
          },
        },
      })

      this.server = opencode.server
      this.client = opencode.client
    } catch (error) {
      await this.cleanupConfigDir()
      restoreEnv(this.envSnapshot)
      throw error
    }
  }

  async createSession(params: CreateSessionParams): Promise<SessionHandle> {
    const sessionApi = getSessionApi(this.requireClient())
    const sessionResult = await sessionApi.create({
      url: "/session",
    })

    const sessionId = unwrapSessionId(sessionResult)

    if (params.systemInstructions) {
      this.sessionInstructions.set(sessionId, params.systemInstructions)
    }

    return {
      sessionId,
      provider: this.id,
      createdAt: new Date().toISOString(),
    }
  }

  async prompt(handle: SessionHandle, text: string, timeoutMs = 120_000): Promise<PromptResult> {
    const sessionApi = getSessionApi(this.requireClient())
    const startTime = Date.now()

    const system = this.sessionInstructions.get(handle.sessionId)

    await sessionApi.promptAsync({
      url: "/session/{id}/prompt_async",
      path: { id: handle.sessionId },
      body: {
        ...(system ? { system } : {}),
        parts: [{ type: "text", text }],
      },
    })

    const remaining = Math.max(1000, timeoutMs - (Date.now() - startTime))
    const messages = await this.pollForCompletion(sessionApi, handle.sessionId, remaining)

    const wallMs = Date.now() - startTime

    const lastAssistant = this.findLastAssistantMessage(messages)
    const tokens = this.extractTokens(messages)
    const toolCalls = this.extractToolCallRecords(messages)
    const outputText = this.extractText(lastAssistant)

    const timing: TimingBreakdown = { wallMs, segments: [] }
    const cost: CostBreakdown = { totalUsd: 0, inputUsd: 0, outputUsd: 0, reasoningUsd: 0 }

    return {
      text: outputText,
      metrics: {
        tokens,
        timing,
        toolCalls,
        cost,
      },
      completionReason: "stop",
    }
  }

  async exportSession(handle: SessionHandle): Promise<SessionTrace> {
    const sessionApi = getSessionApi(this.requireClient())
    const rawMessages = await sessionApi.messages({
      url: "/session/{id}/message",
      path: { id: handle.sessionId },
      query: { limit: 200 },
    })

    const messages = unwrapSessionMessages(rawMessages)
    return this.traceBuilder.buildTrace(handle.sessionId, messages)
  }

  async destroySession(handle: SessionHandle): Promise<void> {
    this.sessionInstructions.delete(handle.sessionId)
  }

  async shutdown(): Promise<void> {
    if (this.server) {
      this.server.close()
      this.server = null
    }
    this.client = null
    await this.cleanupConfigDir()
    restoreEnv(this.envSnapshot)
    this.envSnapshot = { managed: {} as Record<ManagedEnvKey, string | undefined>, extra: {} }
  }

  private requireClient(): unknown {
    if (!this.client) {
      throw new Error("OpenCodeProvider: not initialized — call init() first")
    }
    return this.client
  }

  private async pollForCompletion(
    sessionApi: SessionApi,
    sessionId: string,
    timeoutMs: number,
  ): Promise<unknown[]> {
    const deadline = Date.now() + timeoutMs
    const pollInterval = 300

    while (Date.now() < deadline) {
      const rawMessages = await sessionApi.messages({
        url: "/session/{id}/message",
        path: { id: sessionId },
        query: { limit: 200 },
      })
      const messages = unwrapSessionMessages(rawMessages)
      if (this.isComplete(messages)) {
        return messages
      }
      await new Promise<void>((resolve) => setTimeout(resolve, pollInterval))
    }

    throw new TimeoutError(sessionId, timeoutMs)
  }

  private isComplete(messages: unknown[]): boolean {
    const lastMsg = messages[messages.length - 1]
    if (!lastMsg || typeof lastMsg !== "object") return false
    const msg = lastMsg as Record<string, unknown>

    const parts = msg["parts"] as Array<Record<string, unknown>> | undefined
    if (!parts) return false

    for (const part of parts) {
      if (part["type"] === "step-finish" && part["reason"] === "stop") {
        return true
      }
    }

    return false
  }

  private findLastAssistantMessage(messages: unknown[]): unknown {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      if (!msg || typeof msg !== "object") continue
      const m = msg as Record<string, unknown>
      const info = m["info"] as Record<string, unknown> | undefined
      if (info?.["role"] === "assistant") return msg
    }
    return null
  }

  private extractText(message: unknown): string {
    if (!message || typeof message !== "object") return ""
    const msg = message as Record<string, unknown>
    const parts = msg["parts"] as Array<Record<string, unknown>> | undefined
    if (!parts) return ""

    return parts
      .filter((p) => p["type"] === "text")
      .map((p) => (p["text"] as string) ?? "")
      .join("\n")
  }

  private extractTokens(messages: unknown[]): TokenBreakdown {
    let input = 0
    let output = 0
    let cacheRead = 0
    let cacheWrite = 0
    let reasoning = 0

    for (const message of messages) {
      if (!message || typeof message !== "object") continue
      const msg = message as Record<string, unknown>
      const info = msg["info"] as Record<string, unknown> | undefined
      if (info?.["role"] !== "assistant") continue
      const tokens = info["tokens"] as Record<string, unknown> | undefined
      if (!tokens) continue
      const cache = tokens["cache"] as Record<string, number> | undefined
      input += (tokens["input"] as number) ?? 0
      output += (tokens["output"] as number) ?? 0
      cacheRead += cache?.["read"] ?? 0
      cacheWrite += cache?.["write"] ?? 0
      reasoning += (tokens["reasoning"] as number) ?? 0
    }

    return {
      input,
      output,
      reasoning,
      cacheRead,
      cacheWrite,
      total: input + output + cacheRead + cacheWrite + reasoning,
      active: input + output + reasoning,
    }
  }

  private extractToolCallRecords(messages: unknown[]): readonly ToolCallRecord[] {
    const toolCalls: ToolCallRecord[] = []

    for (const msg of messages) {
      if (!msg || typeof msg !== "object") continue
      const m = msg as Record<string, unknown>
      const info = m["info"] as Record<string, unknown> | undefined
      if (info?.["role"] !== "assistant") continue

      const parts = m["parts"] as Array<Record<string, unknown>> | undefined
      if (!parts) continue

      for (const part of parts) {
        if (part["type"] !== "tool") continue
        const state = part["state"] as Record<string, unknown> | undefined
        if (!state) continue

        const name = (part["tool"] as string) ?? (state["name"] as string) ?? "unknown"
        toolCalls.push({
          name,
          category: classifyToolCall(name, state["input"]),
          success: state["error"] === undefined,
          durationMs: null,
          ...(state["error"] !== undefined ? { error: String(state["error"]) } : {}),
        })
      }
    }

    return toolCalls
  }

  private async cleanupConfigDir(): Promise<void> {
    if (!this.configDir) return
    try {
      const { rm } = await import("node:fs/promises")
      await rm(this.configDir, { recursive: true, force: true })
    } catch {
      // Best-effort cleanup — ignore errors
    }
    this.configDir = ""
  }
}

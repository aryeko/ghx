import type {
  CostBreakdown,
  TimingBreakdown,
  TokenBreakdown,
  ToolCallRecord,
} from "../types/metrics.js"
import type { SessionTrace } from "../types/trace.js"

export interface PermissionConfig {
  readonly autoApprove: boolean
  readonly allowedTools: readonly string[]
}

export interface ProviderConfig {
  readonly port: number
  readonly model: string
  readonly mode: string
  readonly permissions: PermissionConfig
  readonly environment: Readonly<Record<string, string>>
  readonly workdir: string
}

export interface CreateSessionParams {
  readonly systemInstructions: string
  readonly scenarioId: string
  readonly iteration: number
}

export interface SessionHandle {
  readonly sessionId: string
  readonly provider: string
  readonly createdAt: string
}

export interface PromptResult {
  readonly text: string
  readonly metrics: {
    readonly tokens: TokenBreakdown
    readonly timing: TimingBreakdown
    readonly toolCalls: readonly ToolCallRecord[]
    readonly cost: CostBreakdown
  }
  readonly completionReason: "stop" | "timeout" | "error" | "tool_limit"
}

export interface SessionProvider {
  readonly id: string
  init(config: ProviderConfig): Promise<void>
  createSession(params: CreateSessionParams): Promise<SessionHandle>
  prompt(handle: SessionHandle, text: string, timeoutMs?: number): Promise<PromptResult>
  exportSession(handle: SessionHandle): Promise<SessionTrace>
  destroySession(handle: SessionHandle): Promise<void>
  shutdown(): Promise<void>
}

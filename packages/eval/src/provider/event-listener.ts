export class TimeoutError extends Error {
  constructor(
    readonly sessionId: string,
    readonly timeoutMs: number,
  ) {
    super(`Session ${sessionId} timed out after ${timeoutMs}ms`)
    this.name = "TimeoutError"
  }
}

// Minimal OpenCode event type
interface OpenCodeEvent {
  type: string
  data?: Record<string, unknown>
}

export function isTerminalEvent(event: OpenCodeEvent): boolean {
  return (
    event.type === "session.idle" ||
    event.type === "session.error" ||
    (event.type === "step-finish" && event.data?.["reason"] === "stop")
  )
}

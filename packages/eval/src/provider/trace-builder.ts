import type { SessionTrace, TraceEvent, Turn } from "@ghx-dev/agent-profiler"

// OpenCode message types (based on SDK structure)
interface OpenCodeMessagePart {
  type: string
  [key: string]: unknown
}

interface OpenCodeMessageInfo {
  role?: "user" | "assistant"
  time?: { created?: number; completed?: number }
  tokens?: {
    input?: number
    output?: number
    reasoning?: number
    cache?: { read?: number; write?: number }
  }
}

// Actual shape returned by the OpenCode messages API:
// { info: { role, time, tokens }, parts: [...] }
interface OpenCodeMessage {
  info?: OpenCodeMessageInfo
  parts?: readonly OpenCodeMessagePart[]
}

export class TraceBuilder {
  /**
   * Convert an array of OpenCode session messages into TraceEvent[].
   * This bridges OpenCode's message format to the profiler's generic trace model.
   */
  buildEvents(messages: readonly unknown[]): readonly TraceEvent[] {
    const events: TraceEvent[] = []
    let turnNumber = 0

    for (const msg of messages) {
      const message = msg as OpenCodeMessage
      if (message.info?.role !== "assistant") continue

      const created = message.info?.time?.created
      const timestamp =
        typeof created === "number" && Number.isFinite(created)
          ? new Date(created).toISOString()
          : new Date().toISOString()

      events.push({
        type: "turn_boundary",
        turnNumber,
        timestamp,
      })
      turnNumber++

      if (!message.parts) continue

      for (const part of message.parts) {
        const event = this.convertPart(part)
        if (event) events.push(event)
      }
    }

    return events
  }

  private convertPart(part: OpenCodeMessagePart): TraceEvent | null {
    switch (part.type) {
      case "reasoning": {
        // OpenCode ReasoningPart stores the text in the "text" field, not "reasoning"
        const content = (part["text"] as string) ?? ""
        return {
          type: "reasoning",
          content,
          durationMs: 0,
          tokenCount: Math.ceil(content.length / 4),
        }
      }
      case "tool": {
        const state = part["state"] as Record<string, unknown> | undefined
        if (!state) return null
        // tool name is at part["tool"]; fall back to state["name"] for older API shapes
        const name = (part["tool"] as string) ?? (state["name"] as string) ?? "unknown"
        const hasError = state["error"] !== undefined
        return {
          type: "tool_call",
          name,
          input: state["input"] ?? {},
          output: state["output"] ?? state["error"] ?? null,
          durationMs: 0,
          success: !hasError,
          ...(hasError ? { error: String(state["error"]) } : {}),
        }
      }
      case "text": {
        const content = (part["text"] as string) ?? ""
        return {
          type: "text_output",
          content,
          tokenCount: Math.ceil(content.length / 4),
        }
      }
      case "step-finish":
        // step-finish parts signal completion — no trace event needed
        return null
      default:
        return null
    }
  }

  /**
   * Group TraceEvents into Turns using turn_boundary markers.
   */
  groupIntoTurns(events: readonly TraceEvent[]): readonly Turn[] {
    const turns: Turn[] = []
    let currentTurnEvents: TraceEvent[] = []
    let currentTurnNumber = -1
    let currentStartTimestamp = new Date().toISOString()

    for (const event of events) {
      if (event.type === "turn_boundary") {
        if (currentTurnNumber >= 0 && currentTurnEvents.length > 0) {
          turns.push({
            number: currentTurnNumber,
            events: currentTurnEvents,
            startTimestamp: currentStartTimestamp,
            endTimestamp: event.timestamp,
            durationMs: 0,
          })
        }
        currentTurnNumber = event.turnNumber
        currentStartTimestamp = event.timestamp
        currentTurnEvents = []
      } else {
        currentTurnEvents.push(event)
      }
    }

    // Push the last turn
    if (currentTurnNumber >= 0 && currentTurnEvents.length > 0) {
      const endTimestamp = new Date().toISOString()
      turns.push({
        number: currentTurnNumber,
        events: currentTurnEvents,
        startTimestamp: currentStartTimestamp,
        endTimestamp,
        durationMs: 0,
      })
    }

    return turns
  }

  /**
   * Build a full SessionTrace from raw OpenCode messages.
   */
  buildTrace(sessionId: string, messages: readonly unknown[]): SessionTrace {
    const events = this.buildEvents(messages)
    const turns = this.groupIntoTurns(events)

    let inputTokens = 0
    let outputTokens = 0
    let reasoningTokens = 0
    let cacheReadTokens = 0
    let cacheWriteTokens = 0

    for (const msg of messages) {
      const message = msg as OpenCodeMessage
      const info = message.info
      if (info?.role !== "assistant" || !info.tokens) continue
      inputTokens += info.tokens.input ?? 0
      outputTokens += info.tokens.output ?? 0
      reasoningTokens += info.tokens.reasoning ?? 0
      cacheReadTokens += info.tokens.cache?.read ?? 0
      cacheWriteTokens += info.tokens.cache?.write ?? 0
    }

    const total = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens + reasoningTokens
    const active = inputTokens + outputTokens + reasoningTokens

    const totalTokens = {
      input: inputTokens,
      output: outputTokens,
      reasoning: reasoningTokens,
      cacheRead: cacheReadTokens,
      cacheWrite: cacheWriteTokens,
      total,
      active,
    }

    const firstTurn = turns[0]
    const lastTurn = turns[turns.length - 1]
    const totalDuration =
      firstTurn !== undefined && lastTurn !== undefined
        ? new Date(lastTurn.endTimestamp).getTime() - new Date(firstTurn.startTimestamp).getTime()
        : 0

    return {
      sessionId,
      events,
      turns,
      summary: {
        totalTurns: turns.length,
        totalToolCalls: events.filter((e) => e.type === "tool_call").length,
        totalTokens,
        totalDuration,
      },
    }
  }
}

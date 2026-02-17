import type { SessionMessageEntry, SessionMessagePart } from "../domain/types.js"
import { isObject } from "../utils/guards.js"

export function hasAssistantMetadata(info: unknown): boolean {
  if (!isObject(info)) {
    return false
  }

  const hasCompleted =
    isObject(info.time) && typeof (info.time as { completed?: unknown }).completed === "number"
  const hasTokens =
    isObject(info.tokens) && typeof (info.tokens as { input?: unknown }).input === "number"

  return hasCompleted && hasTokens
}

export function hasStructuredOutput(info: unknown): boolean {
  if (!isObject(info)) {
    return false
  }

  const structuredOutput = (info as { structured_output?: unknown }).structured_output
  const structured = (info as { structured?: unknown }).structured

  return structuredOutput !== undefined || structured !== undefined
}

export function hasAssistantSignalParts(parts: SessionMessagePart[]): boolean {
  return parts.some((part) => part.type === "step-finish" || part.type === "tool")
}

export function hasTextPart(parts: SessionMessagePart[]): boolean {
  return parts.some((part) => part.type === "text" && typeof part.text === "string")
}

export function hasAssistantSignal(entry: SessionMessageEntry): boolean {
  if (!entry.info) {
    return false
  }

  return (
    hasAssistantMetadata(entry.info) ||
    hasStructuredOutput(entry.info) ||
    (entry.info as { role?: unknown }).role === "assistant"
  )
}

export function messageProgressSignature(messages: SessionMessageEntry[]): string {
  return messages
    .map((entry) => {
      const info = entry.info as { id?: unknown; role?: unknown } | undefined
      const id = typeof info?.id === "string" ? info.id : "<no-id>"
      const role = typeof info?.role === "string" ? info.role : "<no-role>"
      const parts = entry.parts ?? []
      const stepFinish = [...parts].reverse().find((part) => part.type === "step-finish")
      const stepReason = typeof stepFinish?.reason === "string" ? stepFinish.reason : "<none>"
      return `${id}:${role}:${parts.length}:${stepReason}`
    })
    .join("|")
}

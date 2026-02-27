import type { PromptResult, SessionHandle } from "../../src/contracts/provider.js"
import type {
  CostBreakdown,
  CustomMetric,
  TimingBreakdown,
  TokenBreakdown,
  ToolCallRecord,
} from "../../src/types/metrics.js"
import type { CheckpointResult, ProfileRow } from "../../src/types/profile-row.js"
import type { BaseScenario } from "../../src/types/scenario.js"
import type { SessionTrace, TraceEvent, Turn } from "../../src/types/trace.js"

export function makeTokenBreakdown(overrides: Partial<TokenBreakdown> = {}): TokenBreakdown {
  return {
    input: 100,
    output: 50,
    reasoning: 20,
    cacheRead: 10,
    cacheWrite: 5,
    total: 150,
    active: 140,
    ...overrides,
  }
}

export function makeTimingBreakdown(overrides: Partial<TimingBreakdown> = {}): TimingBreakdown {
  return {
    wallMs: 1000,
    segments: [],
    ...overrides,
  }
}

export function makeCostBreakdown(overrides: Partial<CostBreakdown> = {}): CostBreakdown {
  return {
    totalUsd: 0.01,
    inputUsd: 0.005,
    outputUsd: 0.003,
    reasoningUsd: 0.002,
    ...overrides,
  }
}

export function makeToolCallRecord(overrides: Partial<ToolCallRecord> = {}): ToolCallRecord {
  return {
    name: "bash",
    category: "shell",
    success: true,
    durationMs: 100,
    ...overrides,
  }
}

export function makePromptResult(overrides: Partial<PromptResult> = {}): PromptResult {
  return {
    text: "Task completed successfully",
    metrics: {
      tokens: makeTokenBreakdown(),
      timing: makeTimingBreakdown(),
      toolCalls: [makeToolCallRecord()],
      cost: makeCostBreakdown(),
    },
    completionReason: "stop",
    ...overrides,
  }
}

export function makeSessionHandle(overrides: Partial<SessionHandle> = {}): SessionHandle {
  return {
    sessionId: "ses_test_001",
    provider: "test-provider",
    createdAt: "2026-02-27T00:00:00.000Z",
    ...overrides,
  }
}

export function makeBaseScenario(overrides: Partial<BaseScenario> = {}): BaseScenario {
  return {
    id: "test-scenario-001",
    name: "Test Scenario",
    description: "A test scenario for unit tests",
    prompt: "Fix the bug in the code",
    timeoutMs: 120_000,
    allowedRetries: 1,
    tags: ["test"],
    extensions: {},
    ...overrides,
  }
}

export function makeTraceEvent(overrides: Partial<TraceEvent & { type: string }> = {}): TraceEvent {
  const type = overrides.type ?? "text_output"
  switch (type) {
    case "reasoning":
      return {
        type: "reasoning",
        content: "Let me think about this...",
        durationMs: 500,
        tokenCount: 50,
        ...(overrides as Partial<Extract<TraceEvent, { type: "reasoning" }>>),
      }
    case "tool_call":
      return {
        type: "tool_call",
        name: "bash",
        input: { command: "ls" },
        output: "file1.ts\nfile2.ts",
        durationMs: 200,
        success: true,
        ...(overrides as Partial<Extract<TraceEvent, { type: "tool_call" }>>),
      }
    case "turn_boundary":
      return {
        type: "turn_boundary",
        turnNumber: 1,
        timestamp: "2026-02-27T00:00:00.000Z",
        ...(overrides as Partial<Extract<TraceEvent, { type: "turn_boundary" }>>),
      }
    case "error":
      return {
        type: "error",
        message: "Something went wrong",
        recoverable: true,
        ...(overrides as Partial<Extract<TraceEvent, { type: "error" }>>),
      }
    default:
      return {
        type: "text_output",
        content: "Here is the output",
        tokenCount: 30,
        ...(overrides as Partial<Extract<TraceEvent, { type: "text_output" }>>),
      }
  }
}

export function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    number: 1,
    events: [makeTraceEvent()],
    startTimestamp: "2026-02-27T00:00:00.000Z",
    endTimestamp: "2026-02-27T00:01:00.000Z",
    durationMs: 60_000,
    ...overrides,
  }
}

export function makeSessionTrace(overrides: Partial<SessionTrace> = {}): SessionTrace {
  return {
    sessionId: "ses_test_001",
    events: [makeTraceEvent()],
    turns: [makeTurn()],
    summary: {
      totalTurns: 1,
      totalToolCalls: 0,
      totalTokens: makeTokenBreakdown(),
      totalDuration: 1000,
    },
    ...overrides,
  }
}

export function makeProfileRow(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    runId: "run_test_001",
    scenarioId: "test-scenario-001",
    mode: "test-mode",
    model: "test-model",
    iteration: 1,
    startedAt: "2026-02-27T00:00:00.000Z",
    completedAt: "2026-02-27T00:01:00.000Z",
    tokens: makeTokenBreakdown(),
    timing: makeTimingBreakdown(),
    toolCalls: {
      total: 1,
      byCategory: { shell: 1 },
      failed: 0,
      retried: 0,
      errorRate: 0,
      records: [makeToolCallRecord()],
    },
    cost: makeCostBreakdown(),
    success: true,
    checkpointsPassed: 3,
    checkpointsTotal: 3,
    checkpointDetails: [],
    outputValid: true,
    provider: "test-provider",
    sessionId: "ses_test_001",
    agentTurns: 1,
    completionReason: "stop",
    extensions: {},
    ...overrides,
  }
}

export function makeCheckpointResult(overrides: Partial<CheckpointResult> = {}): CheckpointResult {
  return {
    id: "chk-001",
    description: "Check that the file was created",
    passed: true,
    ...overrides,
  }
}

export function makeCustomMetric(overrides: Partial<CustomMetric> = {}): CustomMetric {
  return {
    name: "test_metric",
    value: 42,
    unit: "count",
    ...overrides,
  }
}

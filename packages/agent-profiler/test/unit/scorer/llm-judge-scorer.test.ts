import { describe, expect, it, vi } from "vitest"
import type { JudgeProvider, JudgeResponse } from "../../../src/contracts/judge-provider.js"
import type { ScorerContext } from "../../../src/contracts/scorer.js"
import { LlmJudgeScorer } from "../../../src/scorer/llm-judge-scorer.js"
import type { BaseScenario } from "../../../src/types/scenario.js"
import type { SessionTrace } from "../../../src/types/trace.js"

const makeProvider = (response: JudgeResponse): JudgeProvider => ({
  id: "mock-judge",
  judge: vi.fn().mockResolvedValue(response),
})

const makeScenario = (rubric?: unknown): BaseScenario => ({
  id: "test",
  name: "Test Scenario",
  description: "A test",
  prompt: "Do the task",
  timeoutMs: 60_000,
  allowedRetries: 0,
  tags: ["basic"],
  extensions: rubric ? { rubric } : {},
})

const makeContext = (trace: SessionTrace | null = null): ScorerContext => ({
  agentOutput: "I completed the task",
  trace,
  mode: "ghx",
  model: "gpt-4o",
  iteration: 0,
  metadata: {},
})

const validRubric = {
  criteria: [
    { id: "strategy-task-fit", description: "Was the approach proportionate?" },
    { id: "tool-selection", description: "Right tools?" },
  ],
}

const validResponse = (verdicts: unknown[]): JudgeResponse => ({
  text: JSON.stringify({ verdicts }),
  tokenCount: 100,
})

describe("LlmJudgeScorer", () => {
  it("returns neutral result when no rubric in scenario", async () => {
    const scorer = new LlmJudgeScorer({
      id: "llm-judge",
      provider: makeProvider(validResponse([])),
    })
    const result = await scorer.evaluate(makeScenario(), makeContext())
    expect(result.success).toBe(true)
    expect(result.passed).toBe(0)
    expect(result.total).toBe(0)
    expect(result.details).toHaveLength(0)
  })

  it("calls judge provider with constructed prompt", async () => {
    const provider = makeProvider(
      validResponse([
        { id: "strategy-task-fit", passed: true, reasoning: "Good" },
        { id: "tool-selection", passed: true, reasoning: "Appropriate" },
      ]),
    )
    const scorer = new LlmJudgeScorer({ id: "llm-judge", provider })
    await scorer.evaluate(makeScenario(validRubric), makeContext())
    expect(provider.judge).toHaveBeenCalledOnce()
    const request = vi.mocked(provider.judge).mock.calls[0]?.[0]
    expect(request?.systemPrompt).toContain("strategy-task-fit")
    expect(request?.userPrompt).toContain("Test Scenario")
  })

  it("maps valid verdicts to ScorerResult", async () => {
    const provider = makeProvider(
      validResponse([
        { id: "strategy-task-fit", passed: true, reasoning: "Proportionate" },
        { id: "tool-selection", passed: false, reasoning: "Used 4 REST calls" },
      ]),
    )
    const scorer = new LlmJudgeScorer({ id: "llm-judge", provider })
    const result = await scorer.evaluate(makeScenario(validRubric), makeContext())
    expect(result.success).toBe(false)
    expect(result.passed).toBe(1)
    expect(result.total).toBe(2)
    expect(result.details[0]?.passed).toBe(true)
    expect(result.details[1]?.passed).toBe(false)
    expect(result.details[1]?.actual).toBe("Used 4 REST calls")
  })

  it("handles malformed JSON response", async () => {
    const provider = makeProvider({ text: "not json", tokenCount: 50 })
    const scorer = new LlmJudgeScorer({ id: "llm-judge", provider })
    const result = await scorer.evaluate(makeScenario(validRubric), makeContext())
    expect(result.success).toBe(false)
    expect(result.outputValid).toBe(false)
    expect(result.passed).toBe(0)
    expect(result.total).toBe(2)
  })

  it("handles partial verdict list", async () => {
    const provider = makeProvider(
      validResponse([
        { id: "strategy-task-fit", passed: true, reasoning: "Good" },
        // tool-selection verdict missing
      ]),
    )
    const scorer = new LlmJudgeScorer({ id: "llm-judge", provider })
    const result = await scorer.evaluate(makeScenario(validRubric), makeContext())
    expect(result.success).toBe(false)
    expect(result.passed).toBe(1)
    expect(result.total).toBe(2)
    const missing = result.details.find((d) => d.id === "tool-selection")
    expect(missing?.passed).toBe(false)
    expect(missing?.error).toContain("No verdict returned")
  })

  it("uses degraded prompt when trace is null", async () => {
    const provider = makeProvider(
      validResponse([
        { id: "strategy-task-fit", passed: true, reasoning: "OK" },
        { id: "tool-selection", passed: true, reasoning: "OK" },
      ]),
    )
    const scorer = new LlmJudgeScorer({ id: "llm-judge", provider })
    await scorer.evaluate(makeScenario(validRubric), makeContext(null))
    const request = vi.mocked(provider.judge).mock.calls[0]?.[0]
    expect(request?.userPrompt).toContain("I completed the task")
    expect(request?.userPrompt).not.toContain("Tool call sequence")
  })

  it("includes trace summary and tool call sequence when trace is provided", async () => {
    const trace: SessionTrace = {
      sessionId: "session-1",
      events: [
        {
          type: "tool_call",
          name: "list_issues",
          input: {},
          output: {},
          durationMs: 100,
          success: true,
        },
        {
          type: "tool_call",
          name: "create_pr",
          input: {},
          output: {},
          durationMs: 200,
          success: false,
          error: "Rate limited",
        },
      ],
      turns: [],
      summary: {
        totalTurns: 2,
        totalToolCalls: 2,
        totalTokens: {
          input: 100,
          output: 50,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 150,
          active: 150,
        },
        totalDuration: 300,
      },
    }
    const provider = makeProvider(
      validResponse([
        { id: "strategy-task-fit", passed: true, reasoning: "Good" },
        { id: "tool-selection", passed: true, reasoning: "Good" },
      ]),
    )
    const scorer = new LlmJudgeScorer({ id: "llm-judge", provider })
    await scorer.evaluate(makeScenario(validRubric), makeContext(trace))
    const request = vi.mocked(provider.judge).mock.calls[0]?.[0]
    expect(request?.userPrompt).toContain("Tool call sequence")
    expect(request?.userPrompt).toContain("list_issues")
    expect(request?.userPrompt).toContain("create_pr")
  })

  it("includes grading instructions in system prompt when present", async () => {
    const rubricWithInstructions = {
      ...validRubric,
      gradingInstructions: "Be extra strict about tool selection.",
    }
    const provider = makeProvider(
      validResponse([
        { id: "strategy-task-fit", passed: true, reasoning: "OK" },
        { id: "tool-selection", passed: true, reasoning: "OK" },
      ]),
    )
    const scorer = new LlmJudgeScorer({ id: "llm-judge", provider })
    await scorer.evaluate(makeScenario(rubricWithInstructions), makeContext())
    const request = vi.mocked(provider.judge).mock.calls[0]?.[0]
    expect(request?.systemPrompt).toContain("Be extra strict about tool selection.")
  })

  it("sets error message and populates details for all criteria on malformed JSON", async () => {
    const provider = makeProvider({ text: "not json", tokenCount: 50 })
    const scorer = new LlmJudgeScorer({ id: "llm-judge", provider })
    const result = await scorer.evaluate(makeScenario(validRubric), makeContext())
    expect(result.error).toMatch(/Judge returned invalid JSON/)
    expect(result.details).toHaveLength(2)
    result.details.forEach((d) => {
      expect(d.passed).toBe(false)
      expect(d.error).toBe("No verdict received")
    })
  })
})

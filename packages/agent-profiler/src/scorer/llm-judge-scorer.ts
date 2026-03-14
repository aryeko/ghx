import { z } from "zod"
import type { JudgeCriterion, JudgeProvider } from "../contracts/judge-provider.js"
import { extractRubric } from "../contracts/judge-provider.js"
import type { Scorer, ScorerCheckResult, ScorerContext, ScorerResult } from "../contracts/scorer.js"
import type { BaseScenario } from "../types/scenario.js"
import type { SessionTrace, TraceEvent } from "../types/trace.js"

const VerdictSchema = z.object({
  id: z.string(),
  passed: z.boolean(),
  reasoning: z.string(),
})

const JudgeResponseSchema = z.object({
  verdicts: z.array(VerdictSchema),
})

type Verdict = z.infer<typeof VerdictSchema>

export interface LlmJudgeScorerOptions {
  readonly id: string
  readonly provider: JudgeProvider
}

function buildSystemPrompt(
  criteria: readonly JudgeCriterion[],
  gradingInstructions?: string,
): string {
  const parts: string[] = []

  if (gradingInstructions) {
    parts.push(gradingInstructions)
    parts.push("")
  }

  parts.push("You are evaluating an AI agent's session behavior.")
  parts.push("")
  parts.push("Evaluation criteria:")
  for (const criterion of criteria) {
    parts.push(`- ${criterion.id}: ${criterion.description}`)
  }
  parts.push("")
  parts.push(
    "Evaluate each criterion based on the session information provided. " +
      "For criteria that are not applicable (e.g., recovery-quality when no errors occurred), " +
      'return a verdict of { passed: true, reasoning: "N/A: <reason>" }.',
  )
  parts.push("")
  parts.push("Return your evaluation as structured JSON in exactly this format:")
  parts.push(
    JSON.stringify(
      {
        verdicts: [{ id: "criterion-id", passed: true, reasoning: "..." }],
      },
      null,
      2,
    ),
  )

  return parts.join("\n")
}

function buildUserPrompt(scenario: BaseScenario, context: ScorerContext): string {
  const parts: string[] = []

  const difficulty = scenario.tags.find((t) => t.startsWith("difficulty:")) ?? null

  parts.push(`Scenario: ${scenario.name}`)
  parts.push(`Description: ${scenario.description}`)
  if (difficulty) {
    parts.push(`Difficulty: ${difficulty.replace("difficulty:", "")}`)
  }
  parts.push("")
  parts.push("Prompt given to the agent:")
  parts.push(scenario.prompt)
  parts.push("")

  parts.push("Agent output:")
  parts.push(context.agentOutput)
  parts.push("")

  if (context.trace !== null) {
    const trace: SessionTrace = context.trace
    const errorCount = trace.events.filter((e) => e.type === "error").length
    parts.push("Session trace summary:")
    parts.push(`- Turns: ${trace.summary.totalTurns}`)
    parts.push(`- Tool calls: ${trace.summary.totalToolCalls}`)
    parts.push(`- Errors: ${errorCount}`)
    parts.push("")

    const toolCalls = trace.events.filter(
      (e): e is Extract<TraceEvent, { type: "tool_call" }> => e.type === "tool_call",
    )
    if (toolCalls.length > 0) {
      parts.push("Tool call sequence:")
      for (const call of toolCalls) {
        const status = call.success ? "success" : "fail"
        parts.push(`- ${call.name} (${status})`)
      }
      parts.push("")
    }
  }

  return parts.join("\n")
}

function mapVerdicts(
  criteria: readonly JudgeCriterion[],
  verdicts: readonly Verdict[],
): readonly ScorerCheckResult[] {
  const verdictMap = new Map<string, Verdict>()
  for (const verdict of verdicts) {
    verdictMap.set(verdict.id, verdict)
  }

  return criteria.map((criterion) => {
    const verdict = verdictMap.get(criterion.id)
    if (verdict === undefined) {
      return {
        id: criterion.id,
        description: criterion.description,
        passed: false,
        error: "No verdict returned by judge",
      }
    }
    return {
      id: criterion.id,
      description: criterion.description,
      passed: verdict.passed,
      actual: verdict.reasoning,
    }
  })
}

export class LlmJudgeScorer implements Scorer {
  readonly id: string
  private readonly provider: JudgeProvider

  constructor(options: LlmJudgeScorerOptions) {
    this.id = options.id
    this.provider = options.provider
  }

  async evaluate(scenario: BaseScenario, context: ScorerContext): Promise<ScorerResult> {
    const rubric = extractRubric(scenario)

    if (rubric === undefined) {
      return {
        success: true,
        passed: 0,
        total: 0,
        outputValid: true,
        details: [],
      }
    }

    const { criteria } = rubric
    const systemPrompt = buildSystemPrompt(criteria, rubric.gradingInstructions)
    const userPrompt = buildUserPrompt(scenario, context)

    const response = await this.provider.judge({ systemPrompt, userPrompt })

    let parsed: z.infer<typeof JudgeResponseSchema>
    try {
      const raw: unknown = JSON.parse(response.text)
      parsed = JudgeResponseSchema.parse(raw)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      const details: readonly ScorerCheckResult[] = criteria.map((criterion) => ({
        id: criterion.id,
        description: criterion.description,
        passed: false,
        error: "No verdict received",
      }))
      return {
        success: false,
        passed: 0,
        total: criteria.length,
        outputValid: false,
        error: `Judge returned invalid JSON: ${errorMessage}`,
        details,
      }
    }

    const details = mapVerdicts(criteria, parsed.verdicts)
    const passedCount = details.filter((d) => d.passed).length

    return {
      success: passedCount === criteria.length,
      passed: passedCount,
      total: criteria.length,
      outputValid: true,
      details,
    }
  }
}

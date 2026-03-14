import { z } from "zod"
import type { BaseScenario } from "../types/scenario.js"

/** Request sent to an LLM judge for evaluation. */
export interface JudgeRequest {
  /** System prompt containing role definition, criteria, and grading instructions. */
  readonly systemPrompt: string
  /** User prompt containing scenario context, agent output, and trace summary. */
  readonly userPrompt: string
}

/** Response returned by an LLM judge. */
export interface JudgeResponse {
  /** Raw text response from the LLM. */
  readonly text: string
  /** Token count for the judge call, if available. */
  readonly tokenCount?: number
}

/**
 * Provider-agnostic interface for making LLM judge calls.
 *
 * The caller is responsible for initializing and shutting down the provider
 * before and after use. The JudgeProvider contract does not include lifecycle
 * methods -- this keeps it minimal and allows different consumers to manage
 * lifecycle in their own way (e.g., via RunHooks, explicit init/shutdown, etc.).
 */
export interface JudgeProvider {
  /** Unique identifier for this judge provider implementation. */
  readonly id: string
  /** Send a judge request and receive a structured response. */
  judge(request: JudgeRequest): Promise<JudgeResponse>
}

/** A single criterion the LLM judge evaluates. */
export interface JudgeCriterion {
  /** Unique identifier for this criterion (e.g., "strategy-task-fit"). */
  readonly id: string
  /** Description of what to evaluate, included in the judge prompt. */
  readonly description: string
}

/** Rubric defining criteria for LLM judge evaluation. Stored in scenario.extensions.rubric. */
export interface JudgeRubric {
  /** Criteria the judge evaluates. */
  readonly criteria: readonly JudgeCriterion[]
  /** Optional preamble for the judge LLM, prepended to grading instructions. */
  readonly gradingInstructions?: string
}

const JudgeCriterionSchema = z.object({
  id: z.string(),
  description: z.string(),
})

const JudgeRubricSchema = z.object({
  criteria: z.array(JudgeCriterionSchema).readonly(),
  gradingInstructions: z.string().optional(),
})

export function extractRubric(scenario: BaseScenario): JudgeRubric | undefined {
  const raw = scenario.extensions["rubric"]
  if (!raw) return undefined
  const result = JudgeRubricSchema.safeParse(raw)
  if (!result.success) return undefined
  return result.data as JudgeRubric
}

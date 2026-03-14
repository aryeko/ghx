# Implementing a Judge Provider

Guide to implementing the JudgeProvider contract for LLM-based evaluation of agent sessions, including rubric definition, scorer integration, and testing patterns.

## When to Use Judge vs. Rule-Based Scoring

Judge-based evaluation and rule-based scoring serve different purposes. Use this decision matrix to choose the right approach.

| Use Case | Approach |
|----------|----------|
| Subjective quality assessment (e.g., "Was the strategy appropriate?") | Judge |
| Strategy and reasoning evaluation | Judge |
| Nuanced evaluation with context-dependent criteria | Judge |
| Binary checks (e.g., "Did the agent call tool X?") | Rule-based Scorer |
| API verification and output format validation | Rule-based Scorer |
| File existence or exact string matching | Rule-based Scorer |

For scenarios that need both, use `CompositeScorer` to combine a `CheckpointScorer` with an `LlmJudgeScorer` (see [Combining with CompositeScorer](#combining-with-compositescorer)).

## The JudgeProvider Interface

The `JudgeProvider` contract is minimal -- an `id` and a single `judge` method.

```typescript
import type { JudgeProvider, JudgeRequest, JudgeResponse } from "@ghx-dev/agent-profiler"

const myProvider: JudgeProvider = {
  id: "my-judge",
  async judge(request: JudgeRequest): Promise<JudgeResponse> {
    // Send request.systemPrompt and request.userPrompt to an LLM
    // Return the raw text response
    return { text: "...", tokenCount: 150 }
  },
}
```

### JudgeRequest

| Field | Type | Description |
|-------|------|-------------|
| `systemPrompt` | `string` | Role definition, criteria, and grading instructions for the LLM |
| `userPrompt` | `string` | Scenario context, agent output, and trace summary |

### JudgeResponse

| Field | Type | Description |
|-------|------|-------------|
| `text` | `string` | Raw text response from the LLM (must be valid JSON for `LlmJudgeScorer`) |
| `tokenCount` | `number \| undefined` | Token count for the judge call, if available |

## Defining Rubrics

Rubrics are stored in `scenario.extensions.rubric` and define the criteria the LLM judge evaluates. Each criterion has an `id` and a `description` that gets included in the judge prompt.

```yaml
# scenario definition
id: "create-issue"
name: "Create a GitHub Issue"
prompt: "Create an issue titled 'Bug report' in repo owner/repo"
tags:
  - "difficulty:medium"
extensions:
  rubric:
    gradingInstructions: "Evaluate whether the agent followed best practices."
    criteria:
      - id: "strategy-task-fit"
        description: "The agent chose an appropriate strategy for the task"
      - id: "error-recovery"
        description: "The agent recovered gracefully from any errors encountered"
      - id: "tool-efficiency"
        description: "The agent used the minimum necessary tool calls"
```

The `gradingInstructions` field is optional. When present, it is prepended to the system prompt before the criteria list.

Rubric extraction uses Zod validation internally via `extractRubric()`. If the rubric is missing or malformed, the function returns `undefined` and the `LlmJudgeScorer` passes the scenario through as successful (see next section).

## Using LlmJudgeScorer

`LlmJudgeScorer` is a `Scorer` implementation that bridges a `JudgeProvider` with the profiler's scoring pipeline.

### Construction

```typescript
import { LlmJudgeScorer } from "@ghx-dev/agent-profiler"

const judgeScorer = new LlmJudgeScorer({
  id: "llm-judge",
  provider: myJudgeProvider,
})
```

### Behavior

1. **No rubric defined:** If the scenario has no `extensions.rubric` (or it fails validation), the scorer returns a pass-through result: `{ success: true, passed: 1, total: 1 }` with a single `"no-rubric"` detail. This allows the scorer to be registered globally without failing on scenarios that do not use judge evaluation.

2. **Rubric present:** The scorer builds a system prompt from the criteria and optional grading instructions, builds a user prompt from the scenario context and agent output (including trace summary if available), then calls `provider.judge()`.

3. **Response parsing:** The judge response must be valid JSON matching this structure:

```json
{
  "verdicts": [
    { "id": "strategy-task-fit", "passed": true, "reasoning": "..." },
    { "id": "error-recovery", "passed": true, "reasoning": "N/A: no errors occurred" }
  ]
}
```

Each verdict `id` must match a criterion `id` from the rubric. Missing verdicts are recorded as failures with an error message. If JSON parsing fails entirely, all criteria are marked as failed and `outputValid` is set to `false`.

## Combining with CompositeScorer

Use `CompositeScorer` to run rule-based checks alongside judge evaluation in a single scoring pass.

```typescript
import { CompositeScorer, LlmJudgeScorer } from "@ghx-dev/agent-profiler"
import { checkpointScorer } from "./my-checkpoint-scorer.js"

const scorer = new CompositeScorer({
  scorers: [checkpointScorer, new LlmJudgeScorer({ id: "llm-judge", provider: myProvider })],
})
```

`CompositeScorer` prefixes each check detail `id` with the scorer's `id` and a colon. For example, a checkpoint scorer with `id: "checkpoint"` producing a check `id: "issue-created"` results in `"checkpoint:issue-created"`. The judge scorer's checks become `"llm-judge:strategy-task-fit"`, etc.

If a scorer throws an exception, `CompositeScorer` catches it, marks the result as failed, and includes the error in the details as `"<scorer-id>:error"`. This prevents a single scorer failure from aborting the entire evaluation.

## Implementing a Custom Provider

A minimal provider wrapping an OpenAI-compatible API:

```typescript
import type { JudgeProvider, JudgeRequest, JudgeResponse } from "@ghx-dev/agent-profiler"

export class OpenAIJudgeProvider implements JudgeProvider {
  readonly id = "openai-judge"
  private readonly apiKey: string
  private readonly model: string

  constructor(apiKey: string, model = "gpt-4o") {
    this.apiKey = apiKey
    this.model = model
  }

  async judge(request: JudgeRequest): Promise<JudgeResponse> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as {
      choices: readonly { message: { content: string } }[]
      usage?: { total_tokens: number }
    }

    return {
      text: data.choices[0].message.content,
      tokenCount: data.usage?.total_tokens,
    }
  }
}
```

## Testing

### Mock Provider Pattern

Create a mock `JudgeProvider` that returns predictable responses for unit tests.

```typescript
import type { JudgeProvider, JudgeRequest, JudgeResponse } from "@ghx-dev/agent-profiler"

function createMockProvider(response: JudgeResponse): JudgeProvider {
  return {
    id: "mock-judge",
    async judge(_request: JudgeRequest): Promise<JudgeResponse> {
      return response
    },
  }
}

// Usage: all criteria pass
const allPass = createMockProvider({
  text: JSON.stringify({
    verdicts: [
      { id: "strategy-task-fit", passed: true, reasoning: "Good strategy" },
      { id: "error-recovery", passed: true, reasoning: "N/A" },
    ],
  }),
})
```

### Testing Rubric Extraction

```typescript
import { extractRubric } from "@ghx-dev/agent-profiler"
import type { BaseScenario } from "@ghx-dev/agent-profiler"

it("returns undefined when no rubric is defined", () => {
  const scenario = { extensions: {} } as unknown as BaseScenario
  expect(extractRubric(scenario)).toBeUndefined()
})

it("extracts a valid rubric", () => {
  const scenario = {
    extensions: {
      rubric: {
        criteria: [{ id: "quality", description: "Output is high quality" }],
      },
    },
  } as unknown as BaseScenario

  const rubric = extractRubric(scenario)
  expect(rubric).toBeDefined()
  expect(rubric!.criteria).toHaveLength(1)
  expect(rubric!.criteria[0].id).toBe("quality")
})
```

### Testing Scorer Behavior

```typescript
import { LlmJudgeScorer } from "@ghx-dev/agent-profiler"

it("passes through when no rubric is defined", async () => {
  const scorer = new LlmJudgeScorer({ id: "judge", provider: createMockProvider({ text: "" }) })
  const scenario = { extensions: {} } as unknown as BaseScenario
  const context = { agentOutput: "done", trace: null, mode: "test", model: "m", iteration: 0, metadata: {} }

  const result = await scorer.evaluate(scenario, context)
  expect(result.success).toBe(true)
  expect(result.details[0].id).toBe("no-rubric")
})

it("returns failure when judge returns invalid JSON", async () => {
  const scorer = new LlmJudgeScorer({
    id: "judge",
    provider: createMockProvider({ text: "not json" }),
  })
  const scenario = {
    extensions: { rubric: { criteria: [{ id: "c1", description: "test" }] } },
  } as unknown as BaseScenario
  const context = { agentOutput: "done", trace: null, mode: "test", model: "m", iteration: 0, metadata: {} }

  const result = await scorer.evaluate(scenario, context)
  expect(result.success).toBe(false)
  expect(result.outputValid).toBe(false)
  expect(result.error).toContain("invalid JSON")
})
```

## Gotchas

- **Lifecycle management.** The `JudgeProvider` interface does not include `init()` or `shutdown()` methods. If your provider needs setup or teardown (e.g., connection pooling, token refresh), manage that externally -- for example, via `RunHooks.beforeSuite` and `RunHooks.afterSuite`.

- **Token costs.** Every scenario with a rubric triggers an additional LLM call. For large evaluation suites, this can add significant cost. Consider limiting rubric-based evaluation to a subset of scenarios or using a cheaper model for the judge.

- **Response parsing failures.** If the judge LLM returns non-JSON or JSON that does not match the expected schema, all criteria are marked as failed. The `error` field on the `ScorerResult` will contain the parse error message. Use `response_format: { type: "json_object" }` or equivalent on your provider to reduce this risk.

- **`exactOptionalPropertyTypes` cast.** The project enables `exactOptionalPropertyTypes` in tsconfig. Zod's `.optional()` infers `T | undefined`, which conflicts with TypeScript's strict optional property semantics. When returning Zod-parsed values where the declared return type uses optional fields, you may need to cast the result (e.g., `as JudgeRubric`). See `extractRubric()` for this pattern.

- **Missing verdict IDs.** If the judge omits a criterion from its verdicts array, `LlmJudgeScorer` records it as a failure with `"No verdict returned by judge"`. Ensure your judge prompt and response format instructions are clear about returning all criterion IDs.

## Source Reference

- JudgeProvider contract: `packages/agent-profiler/src/contracts/judge-provider.ts`
- LlmJudgeScorer: `packages/agent-profiler/src/scorer/llm-judge-scorer.ts`
- CompositeScorer: `packages/agent-profiler/src/scorer/composite-scorer.ts`

## Related Documentation

- [Implementing a Scorer](implementing-a-scorer.md) -- the base scoring contract
- [Implementing a Provider](implementing-a-provider.md) -- the primary integration point
- [Scenarios](scenarios.md) -- define scenarios with extensions for rubrics
- [Plugin Contracts](../architecture/plugin-contracts.md) -- full interface definitions
- [Core Concepts](../getting-started/concepts.md) -- mental model and plugin-first architecture

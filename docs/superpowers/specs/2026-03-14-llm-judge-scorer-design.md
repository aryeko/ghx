# LLM Judge Scorer Design

Add LLM-as-judge scoring to the agent-profiler and eval packages, enabling contextual evaluation of agent session behavior that heuristic-based analyzers cannot perform.

## Problem

The existing `CheckpointScorer` evaluates deterministic outcomes (did the right state change happen?). The 5 built-in analyzers are descriptive (what patterns occurred?). Neither can answer contextual questions like "was the agent's strategy proportionate to the task?" or "did the agent choose the right tools?" These require an LLM that understands both the task and the session behavior.

## Scope

### In Scope

- `JudgeProvider` interface in agent-profiler (provider-agnostic LLM calls)
- `LlmJudgeScorer` implementing `Scorer` contract in agent-profiler
- `CompositeScorer` utility in agent-profiler (run N scorers, merge results)
- `OpenCodeJudgeProvider` in eval (implements JudgeProvider via OpenCode SDK)
- Three profiling-focused judge criteria: strategy-task fit, tool selection appropriateness, recovery quality
- Rubric schema using existing `BaseScenario.extensions` field

### Out of Scope

- Output quality evaluation (insightful comments, clear explanations)
- Changes to `BaseScenario` type definition
- Changes to `ProfileRow` schema
- Changes to reporter or stats modules
- New analyzer implementations
- Per-(mode,scenario) aggregated judging (per-iteration verdicts are aggregated by the existing reporter instead)

## Architecture

### Data Flow

```
Profile Runner (agent-profiler)
  |
  +-- runs agent session via SessionProvider (OpenCodeProvider)
  +-- collects metrics via Collectors
  +-- analyzes trace via Analyzers
  +-- scores via CompositeScorer
       +-- CheckpointScorer -> deterministic pass/fail (existing)
       +-- LlmJudgeScorer
            +-- reads rubric from scenario.extensions (Zod-validated)
            +-- builds prompt from trace summary + tool sequence
            +-- calls JudgeProvider (OpenCodeJudgeProvider)
                 +-- sends prompt via OpenCode SDK -> gets JSON verdicts
```

### Component Details

#### 1. JudgeProvider Interface (agent-profiler)

File: `packages/agent-profiler/src/contracts/judge-provider.ts`

Also contains: `JudgeRubric`, `JudgeCriterion` types (co-located with the provider since the rubric shapes the request).

```typescript
interface JudgeRequest {
  readonly systemPrompt: string
  readonly userPrompt: string
}

interface JudgeResponse {
  readonly text: string
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
interface JudgeProvider {
  readonly id: string
  judge(request: JudgeRequest): Promise<JudgeResponse>
}

interface JudgeCriterion {
  readonly id: string
  readonly description: string
}

interface JudgeRubric {
  readonly criteria: readonly JudgeCriterion[]
  readonly gradingInstructions?: string
}
```

The profiler ships this interface only. Consumers provide concrete implementations.

#### 2. LlmJudgeScorer (agent-profiler)

File: `packages/agent-profiler/src/scorer/llm-judge-scorer.ts`

Implements the `Scorer` contract. Reads a `JudgeRubric` from `scenario.extensions.rubric`.

**Rubric extraction:** Parse `extensions.rubric` through a `JudgeRubricSchema` Zod validator. If the field is missing or parsing fails, treat as no-rubric and return a pass-through result (success: true, 1/1 passed). This ensures safe composition in a `CompositeScorer` with scenarios that lack rubrics. Note: `exactOptionalPropertyTypes: true` is set in tsconfig -- cast Zod output where needed for optional fields on `JudgeRubric` (e.g., `gradingInstructions`).

**Prompt construction:**

System prompt includes:
- Role definition ("You are evaluating an AI agent's session behavior")
- Criteria definitions from the rubric
- Grading instructions: evaluate each criterion, return structured JSON
- Handling for N/A criteria (e.g., recovery-quality when no errors occurred -- verdict should be `{ passed: true, reasoning: "N/A: no errors occurred" }`)

User prompt includes:
- Scenario name, description, and difficulty
- The prompt given to the agent
- Session trace summary (turn count, tool calls, errors) -- not the full trace
- Tool call sequence (names + success/fail) from the trace

**When `ScorerContext.trace` is null:** Use degraded input -- the user prompt includes only scenario metadata and `ScorerContext.agentOutput` (the agent's final text output). Tool sequence and trace summary are omitted. The judge can still evaluate strategy-task fit from the output but tool-selection and recovery-quality will be less informed. This is acceptable as `sessionExport: false` is an explicit opt-out by the caller.

**Response format enforced via system prompt:**

```json
{
  "verdicts": [
    { "id": "strategy-task-fit", "passed": true, "reasoning": "..." },
    { "id": "tool-selection", "passed": false, "reasoning": "Agent used 4 REST calls when 1 GraphQL query sufficed" }
  ]
}
```

Response validated with a Zod schema (`JudgeResponseSchema`).

**Error handling:**

- **Malformed JSON:** `ScorerResult` with `success: false`, `passed: 0`, `total: criteria.length`, `outputValid: false`, `error: "Judge returned invalid JSON: <parse error>"`. Each criterion gets a `ScorerCheckResult` with `passed: false` and `error: "No verdict received"`.
- **Partial verdict list:** Missing verdicts count as failed. If the LLM returns 2 of 3 expected verdicts, the missing criterion gets `passed: false`, `error: "No verdict returned by judge"`.
- **LLM non-determinism:** Acknowledged. Per-iteration verdicts naturally produce variance across repetitions, which flows into bootstrap CIs via the existing stats pipeline.

**Mapping to ScorerResult:**
- Each verdict becomes a `ScorerCheckResult` with `id`, `description`, `passed`, and `actual` set to the reasoning string
- `success` = all criteria passed (N/A criteria count as passed)
- `passed` / `total` counts from verdicts

#### 3. CompositeScorer (agent-profiler)

File: `packages/agent-profiler/src/scorer/composite-scorer.ts`

```typescript
interface CompositeScorerOptions {
  readonly scorers: readonly Scorer[]
}
```

- Takes N `Scorer` instances, runs all sequentially, merges results
- `success` = true only when every scorer reports success
- Concatenates all `ScorerCheckResult[]` details, prefixing each `id` with the scorer's `id` (e.g., `checkpoint:pr-has-review`, `llm-judge:strategy-task-fit`)
- `passed` / `total` summed across all scorers
- `outputValid` = all scorers report valid output
- If any scorer throws, catches error, records as error detail, continues with remaining scorers

Estimated size: ~50 lines.

#### 4. OpenCodeJudgeProvider (eval)

File: `packages/eval/src/judge/opencode-judge-provider.ts`

Implements `JudgeProvider` using the existing `@opencode-ai/sdk` dependency. Reuses the same SDK import pattern as `OpenCodeProvider`.

- Creates a dedicated OpenCode session for judging (separate from agent sessions)
- Sends `systemPrompt` as system instructions, `userPrompt` as the prompt
- Extracts text response + token count
- Lightweight: no polling loop, no trace building, no tool calls. Simple prompt-in/text-out wrapper
- Model configurable at construction (default: cheaper/faster model than agent under test)
- Lifecycle: `init()` / `shutdown()` methods on the class (not on the `JudgeProvider` interface)

**Lifecycle wiring in eval:**

The eval CLI `run` command constructs the `OpenCodeJudgeProvider` and the `CompositeScorer`. Since `RunHooks` fields are single functions (not arrays), the existing `createEvalHooks()` is extended to accept an optional `judgeProvider` parameter. When provided:
- `beforeRun`: existing fixture verification + `judgeProvider.init()`
- `afterRun`: existing cleanup + `judgeProvider.shutdown()`

The `CompositeScorer` is constructed in the eval CLI `run` command handler, wrapping `CheckpointScorer` and `LlmJudgeScorer`, then passed as the single `scorer` in `ProfileSuiteOptions`.

```typescript
// In eval CLI run command
const judgeProvider = new OpenCodeJudgeProvider({ model: "openai/gpt-4o-mini" })
const llmJudgeScorer = new LlmJudgeScorer({ id: "llm-judge", provider: judgeProvider })
const scorer = new CompositeScorer({
  scorers: [checkpointScorer, llmJudgeScorer],
})
const hooks = createEvalHooks({ fixtureManager, judgeProvider })
```

### Judge Criteria

Three profiling-focused criteria, defined per-scenario in `extensions.rubric`:

1. **Strategy-task fit** (`strategy-task-fit`): Was the complexity of the agent's approach proportionate to the task difficulty? A single-step lookup should not involve multi-turn exploration. A multi-step workflow should not be attempted as a single command.

2. **Tool selection appropriateness** (`tool-selection`): Did the agent choose appropriate tools given what was available? Prefer structured operations over raw CLI parsing. Penalize unnecessary API calls or redundant tool usage. Directly relevant to the ghx hypothesis (does structured routing improve tool selection?).

3. **Recovery quality** (`recovery-quality`): When errors occurred, did the agent recover intelligently (alternative approach, different tool) or brute-force (blind retry)? Score N/A if no errors occurred.

### Rubric in Scenario YAML

```yaml
extensions:
  rubric:
    criteria:
      - id: strategy-task-fit
        description: >
          Was the complexity of the agent's approach proportionate to the task?
          A single-step lookup should not involve multi-turn exploration.
          A multi-step workflow should not be attempted as a single command.
      - id: tool-selection
        description: >
          Did the agent choose appropriate tools given what was available?
          Prefer structured operations over raw CLI parsing.
          Penalize unnecessary API calls or redundant tool usage.
      - id: recovery-quality
        description: >
          When errors occurred, did the agent recover intelligently
          (alternative approach, different tool) or brute-force (blind retry)?
          Score N/A if no errors occurred.
```

### Integration Points

**ProfileRow:** No schema changes. LLM judge verdicts appear as additional `ScorerCheckResult` entries in `checkpointDetails`, prefixed with `llm-judge:`. Existing stats, reporting, and comparison code works unchanged.

**Reports:** LLM judge criteria show up alongside checkpoint results in per-scenario tables. Pairwise comparisons (bootstrap CI, Cohen's d) work on pass rates across repetitions and naturally include judge criteria.

### Token Budget

Judge calls are lightweight. Trace summary + tool sequence is typically under 2K tokens input. Full traces (50K+) are not sent to the judge.

### Cost Estimate

One additional LLM call per iteration. With 3 modes x 5 scenarios x 5 repetitions = 75 judge calls per run. At ~2K tokens input + ~500 tokens output per call with a fast model, roughly $0.05-0.15 per full eval run.

## New Files

| File | Package | Purpose |
|---|---|---|
| `contracts/judge-provider.ts` | agent-profiler | JudgeProvider interface, JudgeRubric/JudgeCriterion types, request/response types |
| `scorer/llm-judge-scorer.ts` | agent-profiler | LlmJudgeScorer implementation |
| `scorer/composite-scorer.ts` | agent-profiler | CompositeScorer utility |
| `judge/opencode-judge-provider.ts` | eval | OpenCodeJudgeProvider implementation |

## Public API Changes

**agent-profiler exports (new):**
- `JudgeProvider`, `JudgeRequest`, `JudgeResponse`
- `JudgeRubric`, `JudgeCriterion`
- `LlmJudgeScorer`
- `CompositeScorer`, `CompositeScorerOptions`

**eval exports (new):**
- `OpenCodeJudgeProvider`

## Testing Strategy

- **LlmJudgeScorer unit tests:** Mock `JudgeProvider`, verify prompt construction from rubric + trace summary, verify Zod parsing of valid/invalid/partial responses, verify pass-through when no rubric present, verify degraded behavior when trace is null
- **CompositeScorer unit tests:** Mock multiple `Scorer` instances, verify merge logic, verify error isolation between scorers, verify id prefixing
- **OpenCodeJudgeProvider unit tests:** Mock OpenCode SDK, verify session lifecycle, verify prompt/response mapping
- **Integration test:** CompositeScorer with real CheckpointScorer + LlmJudgeScorer (mocked provider), verify merged ScorerResult shape

## Design Decisions

1. **Per-iteration judging (not per-scenario aggregate):** The judge runs once per iteration, producing independent verdicts that flow through the existing stats pipeline (bootstrap CIs, pass rates). Cross-iteration patterns ("4/5 runs had poor tool selection") are derived by the reporter from per-iteration verdicts, same as checkpoint pass rates. This avoids a new contract and keeps the runner unchanged.

2. **No `weight` field on criteria:** Binary pass/fail per criterion. Weighted scoring adds complexity without clear value for the current use case. Can be added later if needed.

3. **No `any_must_pass` merge strategy:** `CompositeScorer` only supports all-must-pass. The any-must-pass option has no current use case and can be added trivially if needed.

4. **JudgeProvider has no lifecycle methods:** Keeps the interface minimal. Lifecycle is managed externally by the consumer (eval manages it via hooks). Documented in JSDoc.

5. **Rubric types co-located with JudgeProvider:** `JudgeRubric` and `JudgeCriterion` live in `contracts/judge-provider.ts` since they shape the judge request. No separate `types/judge.ts` file needed.

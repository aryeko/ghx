# Implementing a Scorer

Step-by-step guide to implementing the Scorer contract that evaluates agent output against scenario-specific checkpoints.

## Scorer Contract

A scorer receives the scenario definition and a context object containing the agent output, then returns a structured result indicating which checks passed and which failed.

```typescript
import type { Scorer } from "@ghx-dev/agent-profiler"

const myScorer: Scorer = {
  id: "my-scorer",
  async evaluate(scenario, context) {
    // Evaluate agent output against scenario expectations
    return { success: true, passed: 1, total: 1, details: [], outputValid: true }
  },
}
```

## Step 1: Create an Object Implementing Scorer

The `Scorer` interface requires an `id` string and an `evaluate` method.

```typescript
import type { Scorer, ScorerResult } from "@ghx-dev/agent-profiler"

const outputScorer: Scorer = {
  id: "output-checker",
  async evaluate(scenario, context): Promise<ScorerResult> {
    // Implementation goes here
  },
}
```

## Step 2: Understand ScorerContext

The `evaluate` method receives the `BaseScenario` and a `ScorerContext` with everything needed to assess the agent's performance.

| Field | Type | Description |
|-------|------|-------------|
| `agentOutput` | `string` | The text returned by `SessionProvider.prompt()` |
| `trace` | `SessionTrace \| null` | Full session trace, or null if session export is disabled |
| `mode` | `string` | The current execution mode |
| `model` | `string` | The model used by the provider |
| `iteration` | `number` | Zero-based iteration index |
| `metadata` | `Readonly<Record<string, unknown>>` | Arbitrary metadata passed through from configuration |

## Step 3: Return a ScorerResult

The `evaluate` method returns a `ScorerResult` containing the overall assessment and individual check details.

```typescript
interface ScorerResult {
  readonly success: boolean
  readonly passed: number
  readonly total: number
  readonly details: readonly ScorerCheckResult[]
  readonly outputValid: boolean
  readonly error?: string
}
```

| Field | Description |
|-------|-------------|
| `success` | `true` if the agent output meets all requirements |
| `passed` | Number of individual checks that passed |
| `total` | Total number of checks evaluated |
| `details` | Array of `ScorerCheckResult` objects, one per check |
| `outputValid` | `true` if the output format is valid, even if content checks fail |
| `error` | Optional error message if scoring itself failed |

Each `ScorerCheckResult` describes a single checkpoint:

```typescript
interface ScorerCheckResult {
  readonly id: string
  readonly description: string
  readonly passed: boolean
  readonly actual?: unknown
  readonly expected?: unknown
  readonly error?: string
}
```

## Step 4: Complete Example

This scorer checks whether the agent output contains expected text stored in the scenario's `extensions.expectedOutput` field.

```typescript
import type { Scorer, ScorerResult, ScorerCheckResult, BaseScenario, ScorerContext } from "@ghx-dev/agent-profiler"

const expectedOutputScorer: Scorer = {
  id: "expected-output",

  async evaluate(scenario: BaseScenario, context: ScorerContext): Promise<ScorerResult> {
    const expected = scenario.extensions.expectedOutput
    if (typeof expected !== "string") {
      return {
        success: false,
        passed: 0,
        total: 1,
        details: [{
          id: "expected-output-present",
          description: "Scenario must define extensions.expectedOutput as a string",
          passed: false,
          error: "Missing or non-string extensions.expectedOutput",
        }],
        outputValid: false,
        error: "Scorer misconfiguration: extensions.expectedOutput is not a string",
      }
    }

    const output = context.agentOutput.toLowerCase()
    const target = expected.toLowerCase()
    const found = output.includes(target)

    const check: ScorerCheckResult = {
      id: "contains-expected",
      description: `Agent output contains "${expected}"`,
      passed: found,
      actual: found ? target : context.agentOutput.slice(0, 200),
      expected: target,
    }

    return {
      success: found,
      passed: found ? 1 : 0,
      total: 1,
      details: [check],
      outputValid: true,
    }
  },
}
```

## Multi-Check Scorer Example

A scorer can evaluate multiple checkpoints in a single call.

```typescript
import type { Scorer, ScorerResult, ScorerCheckResult, BaseScenario, ScorerContext } from "@ghx-dev/agent-profiler"

const multiCheckScorer: Scorer = {
  id: "multi-check",

  async evaluate(scenario: BaseScenario, context: ScorerContext): Promise<ScorerResult> {
    const checks: ScorerCheckResult[] = []

    // Check 1: Output is non-empty
    const nonEmpty = context.agentOutput.trim().length > 0
    checks.push({
      id: "non-empty",
      description: "Agent produced non-empty output",
      passed: nonEmpty,
      actual: nonEmpty ? "non-empty" : "empty",
      expected: "non-empty",
    })

    // Check 2: No error markers in output
    const noErrors = !context.agentOutput.includes("ERROR") && !context.agentOutput.includes("FAILED")
    checks.push({
      id: "no-errors",
      description: "Agent output contains no error markers",
      passed: noErrors,
    })

    // Check 3: Tool calls were made (requires trace)
    if (context.trace) {
      const hasToolCalls = context.trace.events.some((e) => e.type === "tool_call")
      checks.push({
        id: "used-tools",
        description: "Agent made at least one tool call",
        passed: hasToolCalls,
        actual: hasToolCalls ? "tools used" : "no tools used",
        expected: "tools used",
      })
    }

    const passed = checks.filter((c) => c.passed).length

    return {
      success: passed === checks.length,
      passed,
      total: checks.length,
      details: checks,
      outputValid: true,
    }
  },
}
```

## Pitfalls

- **`trace` may be null.** If `sessionExport` is disabled in the configuration and no analyzers are registered, the runner skips `exportSession`. Guard any trace-dependent checks with a null check.
- **`outputValid` should be `true` if the format is valid** even when content checks fail. Set it to `false` only when the output itself is malformed or the scorer cannot parse it. This distinction allows reports to separate format failures from correctness failures.
- **Handle scorer misconfiguration gracefully.** If the scenario does not provide the expected extensions, return a clear error in the `ScorerResult` rather than throwing an exception.

## Source Reference

- Scorer contract: `packages/agent-profiler/src/contracts/scorer.ts`
- Runner scorer invocation: `packages/agent-profiler/src/runner/iteration.ts`

## Related Documentation

- [Implementing a Provider](implementing-a-provider.md) -- the primary integration point
- [Custom Collectors](custom-collectors.md) -- extract additional metrics
- [Scenarios](scenarios.md) -- define scenarios with extensions for scorers
- [Plugin Contracts](../architecture/plugin-contracts.md) -- full interface definitions
- [Core Concepts](../getting-started/concepts.md) -- mental model and plugin-first architecture

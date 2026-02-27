# Scenarios

Understand the BaseScenario type, extending scenarios with custom data, organizing scenarios into sets, and implementing the loader pattern.

## BaseScenario Interface

Every scenario in the profiler conforms to the `BaseScenario` interface. This is the fundamental unit of work that the runner sends to the agent via `SessionProvider.prompt()`.

```typescript
interface BaseScenario {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly prompt: string
  readonly timeoutMs: number
  readonly allowedRetries: number
  readonly tags: readonly string[]
  readonly extensions: Readonly<Record<string, unknown>>
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier used in results, reports, and scenario sets |
| `name` | `string` | Human-readable name for display in reports |
| `description` | `string` | Longer description of what the scenario tests |
| `prompt` | `string` | The text sent to the agent via `SessionProvider.prompt()` |
| `timeoutMs` | `number` | Maximum time in milliseconds for the prompt to complete |
| `allowedRetries` | `number` | Number of retry attempts if the iteration fails |
| `tags` | `readonly string[]` | Classification tags for filtering and grouping |
| `extensions` | `Readonly<Record<string, unknown>>` | Arbitrary key-value data for scorers, collectors, and custom logic |

## Defining a Scenario

Create scenarios as plain objects conforming to `BaseScenario`:

```typescript
import type { BaseScenario } from "@ghx-dev/agent-profiler"

const scenario: BaseScenario = {
  id: "pr-review-001",
  name: "PR Review with mixed threads",
  description: "Agent reviews a PR with resolved and unresolved threads",
  prompt: "Review PR #42 and summarize findings",
  timeoutMs: 60000,
  allowedRetries: 1,
  tags: ["pr", "review"],
  extensions: {
    expectedOutput: "LGTM",
    prNumber: 42,
  },
}
```

## Extending BaseScenario

The `extensions` field is the primary mechanism for attaching domain-specific data to scenarios without modifying the core interface. Scorers and collectors read from `extensions` to drive custom evaluation logic.

### Pattern: Expected Output for Scorers

Store the expected agent output in `extensions` so scorers can compare against it:

```typescript
const scenarioWithExpectation: BaseScenario = {
  id: "issue-label-001",
  name: "Issue labeling",
  description: "Agent assigns correct labels to a new issue",
  prompt: "Label issue #15 based on its content",
  timeoutMs: 30000,
  allowedRetries: 0,
  tags: ["issue", "labeling"],
  extensions: {
    expectedLabels: ["bug", "priority-high"],
    issueNumber: 15,
    repo: "aryeko/test-repo",
  },
}
```

The scorer accesses these values via `scenario.extensions`:

```typescript
const labels = scenario.extensions.expectedLabels as string[]
```

### Pattern: Domain Metadata for Collectors

Attach metadata that custom collectors use to compute domain-specific metrics:

```typescript
const scenarioWithMetadata: BaseScenario = {
  id: "workflow-debug-001",
  name: "Workflow debugging",
  description: "Agent diagnoses a failing CI workflow",
  prompt: "Debug the failing workflow run #789 and suggest a fix",
  timeoutMs: 120000,
  allowedRetries: 2,
  tags: ["workflow", "debugging"],
  extensions: {
    workflowId: 789,
    expectedSteps: 5,
    complexityTier: "high",
  },
}
```

Since `extensions` is typed as `Record<string, unknown>`, always narrow the type when reading values. Use explicit type assertions or runtime checks.

## Scenario Sets

Scenario sets are named groups of scenario IDs for batch execution. They allow you to define reusable collections without duplicating scenario definitions.

### ScenarioSets Type

```typescript
type ScenarioSets = Readonly<Record<string, readonly string[]>>
```

### JSON Definition

Define scenario sets in a JSON file:

```json
{
  "core": [
    "pr-review-001",
    "issue-label-001",
    "workflow-debug-001"
  ],
  "quick": [
    "pr-review-001"
  ],
  "full": [
    "pr-review-001",
    "issue-label-001",
    "workflow-debug-001",
    "release-draft-001",
    "code-search-001"
  ]
}
```

### Referencing Sets in Configuration

Reference a set by name in the YAML configuration:

```yaml
scenarios:
  set: core
```

Or override via CLI:

```bash
npx agent-profiler run --config profile.yaml --scenario-set quick
```

## Scenario Loader Pattern

The `ScenarioLoader` type defines a function that loads scenarios by their IDs from any data source -- files, databases, or APIs.

```typescript
type ScenarioLoader = (ids: readonly string[]) => Promise<readonly BaseScenario[]>
```

### File-Based Loader Example

```typescript
import { readFile } from "node:fs/promises"
import type { BaseScenario } from "@ghx-dev/agent-profiler"

type ScenarioLoader = (ids: readonly string[]) => Promise<readonly BaseScenario[]>

const fileLoader: ScenarioLoader = async (ids) => {
  const scenarios: BaseScenario[] = []

  for (const id of ids) {
    const raw = await readFile(`scenarios/${id}.json`, "utf-8")
    const parsed = JSON.parse(raw) as BaseScenario
    scenarios.push(parsed)
  }

  return scenarios
}
```

### API-Based Loader Example

```typescript
type ScenarioLoader = (ids: readonly string[]) => Promise<readonly BaseScenario[]>

const apiLoader: ScenarioLoader = async (ids) => {
  const response = await fetch("https://api.example.com/scenarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  })

  if (!response.ok) {
    throw new Error(`Scenario API returned ${response.status}`)
  }

  const data = (await response.json()) as { scenarios: BaseScenario[] }
  return data.scenarios
}
```

## Progress Events

The runner emits `ProgressEvent` objects at scenario and iteration boundaries. These events are dispatched to `RunHooks` callbacks and can be used for logging, progress bars, or external integrations.

```typescript
interface ProgressEvent {
  readonly type: "scenario_start" | "scenario_end" | "iteration_start" | "iteration_end"
  readonly scenarioId: string
  readonly mode: string
  readonly iteration: number
  readonly timestamp: string
}
```

| Event Type | When Emitted |
|------------|--------------|
| `scenario_start` | Before the first iteration of a scenario begins |
| `scenario_end` | After all iterations of a scenario complete |
| `iteration_start` | Before a single iteration begins |
| `iteration_end` | After a single iteration completes (including retries) |

## Source Reference

- BaseScenario type: `packages/agent-profiler/src/types/scenario.ts`
- Scenario loader: `packages/agent-profiler/src/config/loader.ts`
- Progress events: `packages/agent-profiler/src/runner/profile-runner.ts`

## Related Documentation

- [Configuration](configuration.md) -- referencing scenarios and sets in YAML
- [Implementing a Scorer](implementing-a-scorer.md) -- reading extensions for evaluation
- [Custom Collectors](custom-collectors.md) -- using scenario data in metric collection
- [Quick Start](../getting-started/quick-start.md) -- defining a simple scenario
- [Profile Runner](../architecture/runner.md) -- how scenarios feed into the execution matrix

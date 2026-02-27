# Quick Start

Run your first profile suite with stub plugins and a single scenario in roughly 50 lines of TypeScript.

## Complete Runnable Example

```typescript
import {
  runProfileSuite,
  TokenCollector,
  LatencyCollector,
  CostCollector,
  ToolCallCollector,
  generateReport,
} from "@ghx-dev/agent-profiler"
import type {
  SessionProvider,
  Scorer,
  ModeResolver,
  BaseScenario,
  ProfileSuiteOptions,
} from "@ghx-dev/agent-profiler"

// 1. Stub SessionProvider -- returns mock data for every prompt
const provider: SessionProvider = {
  id: "stub-provider",
  async init(_config) {},
  async createSession() {
    return { sessionId: "ses_001", provider: "stub-provider", createdAt: new Date().toISOString() }
  },
  async prompt(_handle, _text, _timeoutMs) {
    return {
      text: "Mock response from stub provider.",
      metrics: {
        tokens: {
          input: 100, output: 50, reasoning: 20, cacheRead: 0,
          cacheWrite: 0, total: 170, active: 170,
        },
        timing: { wallMs: 1200, segments: [] },
        toolCalls: [
          { name: "readFile", category: "filesystem", success: true, durationMs: 80 },
        ],
        cost: { totalUsd: 0.003, inputUsd: 0.001, outputUsd: 0.0015, reasoningUsd: 0.0005 },
      },
      completionReason: "stop",
    }
  },
  async exportSession(handle) {
    return {
      sessionId: handle.sessionId,
      events: [],
      turns: [],
      summary: {
        totalTurns: 1,
        totalToolCalls: 1,
        totalTokens: {
          input: 100, output: 50, reasoning: 20, cacheRead: 0,
          cacheWrite: 0, total: 170, active: 170,
        },
        totalDuration: 1200,
      },
    }
  },
  async destroySession() {},
  async shutdown() {},
}

// 2. Stub Scorer -- always passes
const scorer: Scorer = {
  id: "stub-scorer",
  async evaluate(scenario, context) {
    return { success: true, passed: 1, total: 1, details: [], outputValid: true }
  },
}

// 3. Stub ModeResolver -- identity mapping
const modeResolver: ModeResolver = {
  async resolve(mode) {
    return { environment: {}, systemInstructions: `Run in ${mode} mode.`, providerOverrides: {} }
  },
}

// 4. Define a simple scenario
const scenario: BaseScenario = {
  id: "hello-world-001",
  name: "Hello World",
  description: "A minimal scenario that verifies the profiler pipeline works end to end.",
  prompt: "Say hello and list the files in the current directory.",
  timeoutMs: 30_000,
  allowedRetries: 0,
  tags: [],
  extensions: {},
}

// 5. Run the profile suite
const options: ProfileSuiteOptions = {
  modes: ["baseline"],
  scenarios: [scenario],
  repetitions: 1,
  allowedRetries: 0,
  provider,
  scorer,
  modeResolver,
  collectors: [
    new TokenCollector(),
    new LatencyCollector(),
    new CostCollector(),
    new ToolCallCollector(),
  ],
  analyzers: [],
  hooks: {},
  warmup: false,
  sessionExport: true,
  outputJsonlPath: "/tmp/agent-profiler-quickstart.jsonl",
  logLevel: "info",
}

const result = await runProfileSuite(options)

// 6. Generate and print the report
const reportDir = await generateReport({
  runId: result.runId,
  rows: result.rows,
  reportsDir: "/tmp/agent-profiler-reports",
})
console.log(`Report written to ${reportDir}`)
```

## What This Does

1. **Creates a stub `SessionProvider`** that returns fixed mock metrics for every prompt call, avoiding any real agent session.
2. **Creates a stub `Scorer`** that always reports a passing result, so the focus stays on the profiler pipeline rather than evaluation logic.
3. **Creates a stub `ModeResolver`** that performs an identity mapping from mode name to configuration.
4. **Defines a single `BaseScenario`** with a 30-second timeout and no retries.
5. **Calls `runProfileSuite`** with all four built-in collectors (Token, Latency, Cost, ToolCall), no analyzers, no lifecycle hooks, and warmup disabled.
6. **Calls `generateReport`** with a `ReportOptions` object containing the run ID, rows, and output directory, then logs the report path.

## Next Steps

Replace the stub provider with a real `SessionProvider` that drives actual agent sessions. See the [Implementing a Provider](../guides/implementing-a-provider.md) guide for a step-by-step walkthrough.

## Source Reference

- Built-in collectors: `packages/agent-profiler/src/collector/`
- Profile runner: `packages/agent-profiler/src/runner/`
- Report generator: `packages/agent-profiler/src/reporter/`

## Related Documentation

- [Installation](installation.md) -- prerequisites and package setup
- [Core Concepts](concepts.md) -- mental model and plugin-first architecture
- [Implementing a Provider](../guides/implementing-a-provider.md) -- build a real SessionProvider
- [Architecture Overview](../architecture/README.md) -- system design and data flow

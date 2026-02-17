export type RunnerConfig = {
  openCodeMode: string | null
  gitRepo: string | null
  gitCommit: string | null
  firstAssistantTimeoutMs: number
  sessionStallTimeoutMs: number
  maxRunnerRetries: number
  runnerRetryBackoffMs: number
}

export function loadRunnerConfig(): RunnerConfig {
  return {
    openCodeMode: process.env.BENCH_OPENCODE_MODE ?? null,
    gitRepo: process.env.BENCH_GIT_REPO ?? null,
    gitCommit: process.env.BENCH_GIT_COMMIT ?? null,
    firstAssistantTimeoutMs: Number.parseInt(
      process.env.BENCH_FIRST_ASSISTANT_TIMEOUT_MS ?? "15000",
      10,
    ),
    sessionStallTimeoutMs: Number.parseInt(
      process.env.BENCH_SESSION_STALL_TIMEOUT_MS ?? "10000",
      10,
    ),
    maxRunnerRetries: Number.parseInt(process.env.BENCH_RUNNER_MAX_RETRIES ?? "1", 10),
    runnerRetryBackoffMs: Number.parseInt(process.env.BENCH_RUNNER_RETRY_BACKOFF_MS ?? "750", 10),
  }
}

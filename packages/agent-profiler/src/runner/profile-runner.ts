import type { Analyzer } from "../contracts/analyzer.js"
import type { Collector } from "../contracts/collector.js"
import type { RunHooks } from "../contracts/hooks.js"
import type { ModeResolver } from "../contracts/mode-resolver.js"
import type { SessionProvider } from "../contracts/provider.js"
import type { Scorer } from "../contracts/scorer.js"
import type { ProfileRow } from "../types/profile-row.js"
import type { BaseScenario } from "../types/scenario.js"

export interface RunProfileSuiteOptions {
  readonly modes: readonly string[]
  readonly scenarios: readonly BaseScenario[]
  readonly repetitions: number
  readonly outputPath: string
  readonly provider: SessionProvider
  readonly scorer: Scorer
  readonly modeResolver: ModeResolver
  readonly collectors?: readonly Collector[]
  readonly analyzers?: readonly Analyzer[]
  readonly hooks?: RunHooks
}

export interface ProfileSuiteResult {
  readonly runId: string
  readonly rows: readonly ProfileRow[]
  readonly outputPath: string
}

/**
 * Stub implementation — runs the profiling suite.
 * Full implementation is in progress.
 */
export async function runProfileSuite(
  _options: RunProfileSuiteOptions,
): Promise<ProfileSuiteResult> {
  throw new Error(
    "runProfileSuite: not yet implemented — agent-profiler implementation in progress",
  )
}

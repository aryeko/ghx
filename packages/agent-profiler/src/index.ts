// Types

export type { AnalysisFinding, AnalysisResult, Analyzer } from "./contracts/analyzer.js"
export type { Collector, CustomMetric } from "./contracts/collector.js"
export type {
  AfterScenarioContext,
  BeforeScenarioContext,
  RunContext,
  RunHooks,
} from "./contracts/hooks.js"
export type { ModeConfig, ModeResolver } from "./contracts/mode-resolver.js"

// Contracts
export type {
  CreateSessionParams,
  PermissionConfig,
  PromptResult,
  ProviderConfig,
  SessionHandle,
  SessionProvider,
} from "./contracts/provider.js"
export type {
  Scorer,
  ScorerCheckResult,
  ScorerContext,
  ScorerResult,
} from "./contracts/scorer.js"
export type { ProfileSuiteResult, RunProfileSuiteOptions } from "./runner/profile-runner.js"
// Runner
export { runProfileSuite } from "./runner/profile-runner.js"
export type {
  CheckpointResult,
  CostBreakdown,
  TimingBreakdown,
  TimingSegment,
  TokenBreakdown,
  ToolCallRecord,
} from "./types/metrics.js"
export type { ProfileRow } from "./types/profile-row.js"
export type { BaseScenario } from "./types/scenario.js"
export type { SessionTrace, TraceEvent, TraceNormalizer, Turn } from "./types/trace.js"

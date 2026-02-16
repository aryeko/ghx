import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  inferModelSignatureFromRows,
  loadExpectationsConfig,
  resolveGateThresholdsForModel,
  resolveModelForExpectations,
} from "../../src/report/expectations.js"

describe("expectations config", () => {
  it("loads and resolves thresholds for model", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-expectations-"))
    const path = join(root, "expectations.json")
    await writeFile(
      path,
      JSON.stringify({
        default_model: "openai/gpt-5.1-codex-mini",
        expectations: {
          "openai/gpt-5.1-codex-mini": {
            verify_pr: {
              minTokensActiveReductionPct: 10,
              minLatencyReductionPct: 10,
              minToolCallReductionPct: 15,
              minEfficiencyCoveragePct: 70,
              maxSuccessRateDropPct: 6,
              minOutputValidityRatePct: 95,
              maxRunnerFailureRatePct: 7,
              maxTimeoutStallRatePct: 4,
              maxRetryRatePct: 20,
              minSamplesPerScenarioPerMode: 1,
            },
            verify_release: {
              minTokensActiveReductionPct: 12,
              minLatencyReductionPct: 12,
              minToolCallReductionPct: 18,
              minEfficiencyCoveragePct: 75,
              maxSuccessRateDropPct: 4,
              minOutputValidityRatePct: 96,
              maxRunnerFailureRatePct: 6,
              maxTimeoutStallRatePct: 3,
              maxRetryRatePct: 18,
              minSamplesPerScenarioPerMode: 1,
            },
          },
        },
      }),
      "utf8",
    )

    const config = await loadExpectationsConfig(path)
    const thresholds = resolveGateThresholdsForModel(config, "openai/gpt-5.1-codex-mini")
    expect(thresholds.verify_pr.maxSuccessRateDropPct).toBe(6)
  })

  it("infers single model signature from comparable rows", () => {
    const model = inferModelSignatureFromRows([
      {
        mode: "agent_direct",
        model: { provider_id: "openai", model_id: "gpt-5.1-codex-mini" },
      },
      {
        mode: "ghx",
        model: { provider_id: "openai", model_id: "gpt-5.1-codex-mini" },
      },
    ])

    expect(model).toBe("openai/gpt-5.1-codex-mini")
  })

  it("uses explicit expectations model over inferred/default", () => {
    const resolved = resolveModelForExpectations(
      "openai/gpt-5.1-codex-mini",
      "openai/gpt-5.3-codex",
      {
        default_model: "openai/gpt-5.3-codex",
        expectations: {
          "openai/gpt-5.1-codex-mini": {
            verify_pr: {
              minTokensActiveReductionPct: 10,
              minLatencyReductionPct: 10,
              minToolCallReductionPct: 15,
              minEfficiencyCoveragePct: 70,
              maxSuccessRateDropPct: 6,
              minOutputValidityRatePct: 95,
              maxRunnerFailureRatePct: 7,
              maxTimeoutStallRatePct: 4,
              maxRetryRatePct: 20,
              minSamplesPerScenarioPerMode: 1,
            },
            verify_release: {
              minTokensActiveReductionPct: 12,
              minLatencyReductionPct: 12,
              minToolCallReductionPct: 18,
              minEfficiencyCoveragePct: 75,
              maxSuccessRateDropPct: 4,
              minOutputValidityRatePct: 96,
              maxRunnerFailureRatePct: 6,
              maxTimeoutStallRatePct: 3,
              maxRetryRatePct: 18,
              minSamplesPerScenarioPerMode: 1,
            },
          },
          "openai/gpt-5.3-codex": {
            verify_pr: {
              minTokensActiveReductionPct: 15,
              minLatencyReductionPct: 15,
              minToolCallReductionPct: 20,
              minEfficiencyCoveragePct: 80,
              maxSuccessRateDropPct: 3,
              minOutputValidityRatePct: 97,
              maxRunnerFailureRatePct: 5,
              maxTimeoutStallRatePct: 2,
              maxRetryRatePct: 15,
              minSamplesPerScenarioPerMode: 1,
            },
            verify_release: {
              minTokensActiveReductionPct: 22,
              minLatencyReductionPct: 20,
              minToolCallReductionPct: 30,
              minEfficiencyCoveragePct: 95,
              maxSuccessRateDropPct: 1,
              minOutputValidityRatePct: 99,
              maxRunnerFailureRatePct: 2,
              maxTimeoutStallRatePct: 1,
              maxRetryRatePct: 8,
              minSamplesPerScenarioPerMode: 2,
            },
          },
        },
      },
    )

    expect(resolved).toBe("openai/gpt-5.1-codex-mini")
  })
})

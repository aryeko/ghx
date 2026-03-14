import type { Scorer, ScorerCheckResult, ScorerContext, ScorerResult } from "../contracts/scorer.js"
import type { BaseScenario } from "../types/scenario.js"

export interface CompositeScorerOptions {
  readonly scorers: readonly Scorer[]
}

export class CompositeScorer implements Scorer {
  readonly id = "composite"
  private readonly scorers: readonly Scorer[]

  constructor(options: CompositeScorerOptions) {
    this.scorers = options.scorers
  }

  async evaluate(scenario: BaseScenario, context: ScorerContext): Promise<ScorerResult> {
    const allDetails: ScorerCheckResult[] = []
    let totalPassed = 0
    let totalCount = 0
    let allSuccess = true
    let allOutputValid = true

    for (const scorer of this.scorers) {
      try {
        const result = await scorer.evaluate(scenario, context)
        const prefixedDetails = result.details.map((d) => ({
          ...d,
          id: `${scorer.id}:${d.id}`,
        }))
        allDetails.push(...prefixedDetails)
        totalPassed += result.passed
        totalCount += result.total
        if (!result.success) allSuccess = false
        if (!result.outputValid) allOutputValid = false
      } catch (error) {
        allSuccess = false
        allDetails.push({
          id: `${scorer.id}:error`,
          description: `Scorer "${scorer.id}" threw an error`,
          passed: false,
          error: error instanceof Error ? error.message : String(error),
        })
        totalCount += 1
      }
    }

    return {
      success: allSuccess,
      passed: totalPassed,
      total: totalCount,
      details: allDetails,
      outputValid: allOutputValid,
    }
  }
}

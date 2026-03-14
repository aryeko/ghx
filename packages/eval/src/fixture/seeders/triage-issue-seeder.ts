import type { FixtureResource } from "@eval/fixture/manifest.js"
import { runGh } from "@eval/fixture/seeders/gh.js"
import type { FixtureSeeder, SeedOptions } from "@eval/fixture/seeders/types.js"

const TRIAGE_BODY = `## Bug Report

**Environment:** Production (us-east-1)

### Steps to reproduce
1. Send 500+ concurrent requests to the /api/v2/users endpoint
2. Monitor response times over a 5-minute window
3. Observe increasing latency after ~200 requests

### Expected behavior
Response times should remain stable under 200ms p95 regardless of concurrency.

### Actual behavior
Response times degrade to 2-3 seconds after sustained load. Memory usage climbs
steadily, suggesting a connection pool leak. The issue started after the v2.4.1
deployment on Monday.

### Impact
Affecting ~15% of API consumers during peak hours. No data loss observed.`

export function createTriageIssueSeeder(): FixtureSeeder {
  return {
    type: "issue_for_triage",

    async seed(options: SeedOptions): Promise<FixtureResource> {
      const title = `[@ghx-dev/eval] ${options.name}`

      const createArgs = [
        "issue",
        "create",
        "--repo",
        options.repo,
        "--title",
        title,
        "--body",
        TRIAGE_BODY,
        ...options.labels.flatMap((label) => ["--label", label]),
      ]
      await runGh(createArgs)

      const listArgs = [
        "issue",
        "list",
        "--repo",
        options.repo,
        "--label",
        "@ghx-dev/eval",
        "--json",
        "number,title",
        "--limit",
        "1",
        "--search",
        title,
      ]
      const listOutput = await runGh(listArgs)
      const issues: readonly { readonly number: number; readonly title: string }[] =
        JSON.parse(listOutput)

      const match = issues.find((i) => i.title === title)
      if (!match) {
        throw new Error(`Could not find issue "${options.name}" after creation in ${options.repo}`)
      }

      return {
        type: "issue",
        number: match.number,
        repo: options.repo,
        labels: [...options.labels],
        metadata: {},
      }
    },
  }
}

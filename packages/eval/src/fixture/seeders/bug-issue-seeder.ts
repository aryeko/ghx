import type { FixtureResource } from "@eval/fixture/manifest.js"
import { parseIssueNumberFromUrl, runGh } from "@eval/fixture/seeders/gh.js"
import type { FixtureSeeder, SeedOptions } from "@eval/fixture/seeders/types.js"

const SEARCH_TERM = "Memory leak in connection pooling"

const BUG_BODY = `## Bug Report

Users are reporting intermittent connection timeouts when the application is under
sustained load. Investigation points to a connection pool leak in the database
adapter — connections are acquired but not released when queries timeout.

### Reproduction
1. Run the load test suite with 100 concurrent connections
2. After ~3 minutes, observe connection pool exhaustion errors
3. Database shows active connections climbing without release

### Logs
\`\`\`
WARN  pool: no available connections (active=100, idle=0, waiting=47)
ERROR query timeout after 30000ms — connection not returned to pool
\`\`\`
`

export function createBugIssueSeeder(): FixtureSeeder {
  return {
    type: "issue_bug_to_close",

    async seed(options: SeedOptions): Promise<FixtureResource> {
      const title = `[@ghx-dev/eval] ${SEARCH_TERM}`
      const allLabels = [...options.labels, "bug"]

      const createArgs = [
        "issue",
        "create",
        "--repo",
        options.repo,
        "--title",
        title,
        "--body",
        BUG_BODY,
        ...allLabels.flatMap((label) => ["--label", label]),
      ]
      const createUrl = await runGh(createArgs)
      const issueNumber = parseIssueNumberFromUrl(createUrl)

      return {
        type: "issue",
        number: issueNumber,
        repo: options.repo,
        labels: allLabels,
        metadata: { searchTerm: SEARCH_TERM },
      }
    },
  }
}

import type { FixtureResource } from "@eval/fixture/manifest.js"
import { runGh } from "@eval/fixture/seeders/gh.js"
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
        throw new Error(`Could not find bug issue after creation in ${options.repo}`)
      }

      return {
        type: "issue",
        number: match.number,
        repo: options.repo,
        labels: allLabels,
        metadata: { searchTerm: SEARCH_TERM },
      }
    },
  }
}

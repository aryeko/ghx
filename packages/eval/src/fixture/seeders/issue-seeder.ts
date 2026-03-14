import type { FixtureResource } from "@eval/fixture/manifest.js"
import { parseIssueNumberFromUrl, runGh } from "@eval/fixture/seeders/gh.js"
import type { FixtureSeeder, SeedOptions } from "@eval/fixture/seeders/types.js"

export function createIssueSeeder(): FixtureSeeder {
  return {
    type: "issue",

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
        `Auto-created fixture for eval scenario "${options.name}".`,
        ...options.labels.flatMap((label) => ["--label", label]),
      ]
      const createUrl = await runGh(createArgs)
      const issueNumber = parseIssueNumberFromUrl(createUrl)

      return {
        type: "issue",
        number: issueNumber,
        repo: options.repo,
        labels: [...options.labels],
        metadata: {},
      }
    },
  }
}

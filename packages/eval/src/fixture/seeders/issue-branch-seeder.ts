import type { FixtureResource } from "@eval/fixture/manifest.js"
import { parseIssueNumberFromUrl, runGh, runGhWithInput } from "@eval/fixture/seeders/gh.js"
import type { FixtureSeeder, SeedOptions } from "@eval/fixture/seeders/types.js"

const FIXTURE_FILE_CONTENT = `# Eval Fixture Change

This file was added by the eval fixture seeder to create a diff for PR creation.

## Changes
- Added configuration for connection pool monitoring
- Set max idle timeout to 30 seconds
- Enable pool health check on borrow
`

export function createIssueBranchSeeder(): FixtureSeeder {
  return {
    type: "issue_with_branch",

    async seed(options: SeedOptions): Promise<FixtureResource> {
      const branchName = `eval-fix-${options.name}-${Date.now()}`

      // 1. Get default branch using --jq to extract the field directly
      const defaultBranch =
        (await runGh(["api", `repos/${options.repo}`, "--jq", ".default_branch"])) || "main"

      // 2. Get HEAD SHA of default branch using --jq to extract the field directly
      const headSha = await runGh([
        "api",
        `repos/${options.repo}/git/ref/heads/${defaultBranch}`,
        "--jq",
        ".object.sha",
      ])

      // 3. Create a tree with a fixture file
      const treeBody = JSON.stringify({
        base_tree: headSha,
        tree: [
          {
            path: "eval-fixture-change.md",
            mode: "100644",
            type: "blob",
            content: FIXTURE_FILE_CONTENT,
          },
        ],
      })
      const treeRaw = await runGhWithInput(
        ["api", `repos/${options.repo}/git/trees`, "--method", "POST", "--input", "-"],
        treeBody,
      )
      const treeSha = (JSON.parse(treeRaw) as { sha: string }).sha

      // 4. Create a commit
      const commitBody = JSON.stringify({
        message: "feat: add connection pool monitoring config",
        tree: treeSha,
        parents: [headSha],
      })
      const commitRaw = await runGhWithInput(
        ["api", `repos/${options.repo}/git/commits`, "--method", "POST", "--input", "-"],
        commitBody,
      )
      const commitSha = (JSON.parse(commitRaw) as { sha: string }).sha

      // 5. Create the branch ref
      const refBody = JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: commitSha,
      })
      await runGhWithInput(
        ["api", `repos/${options.repo}/git/refs`, "--method", "POST", "--input", "-"],
        refBody,
      )

      // 6. Create the issue
      const title = `[@ghx-dev/eval] ${options.name}`
      const issueBody =
        "Implement connection pool monitoring.\n\nThis issue tracks adding health checks and idle timeout configuration to prevent pool exhaustion under load."
      const createUrl = await runGh([
        "issue",
        "create",
        "--repo",
        options.repo,
        "--title",
        title,
        "--body",
        issueBody,
        ...options.labels.flatMap((label) => ["--label", label]),
      ])
      const issueNumber = parseIssueNumberFromUrl(createUrl)

      return {
        type: "issue",
        number: issueNumber,
        repo: options.repo,
        labels: [...options.labels],
        metadata: {
          headBranch: branchName,
          baseBranch: defaultBranch,
          branchSha: commitSha,
        },
      }
    },
  }
}

import type { FixtureResource } from "@eval/fixture/manifest.js"
import type { FixtureSeeder, SeedOptions } from "@eval/fixture/seeders/types.js"
import { runGh, runGhWithInput, runGhWithToken } from "./gh.js"

// A small TypeScript file with intentional bugs for the agent to review.
const REVIEW_FILE_PATH = "src/utils/helpers.ts"
const REVIEW_FILE_CONTENT = `// Helper utilities
improt { readFileSync } from "fs"

export function readConfig(path: string): string {
  return readFileSync(path, "utf8")
}

export function divide(a: number, b: number): number {
  return a / 0
}

export function waitForReady(): void {
  while (true) {
    // waiting for ready signal
  }
}
`

async function getDefaultBranch(repo: string): Promise<string> {
  const [owner, name] = repo.split("/")
  const stdout = await runGh([
    "api",
    "graphql",
    "-f",
    `query=query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { defaultBranchRef { name } } }`,
    "-f",
    `owner=${owner}`,
    "-f",
    `name=${name}`,
  ])
  const parsed: { data: { repository: { defaultBranchRef: { name: string } } } } =
    JSON.parse(stdout)
  return parsed.data.repository.defaultBranchRef.name
}

async function getHeadSha(repo: string, branch: string): Promise<string> {
  const stdout = await runGh(["api", `repos/${repo}/git/refs/heads/${branch}`])
  const parsed: { object: { sha: string } } = JSON.parse(stdout)
  return parsed.object.sha
}

async function createTree(repo: string, baseSha: string): Promise<string> {
  const body = JSON.stringify({
    base_tree: baseSha,
    tree: [
      { path: ".eval-fixture", mode: "100644", type: "blob", content: "eval fixture placeholder" },
      {
        path: REVIEW_FILE_PATH,
        mode: "100644",
        type: "blob",
        content: REVIEW_FILE_CONTENT,
      },
    ],
  })
  const stdout = await runGhWithInput(
    ["api", `repos/${repo}/git/trees`, "--method", "POST", "--input", "-"],
    body,
  )
  const parsed: { sha: string } = JSON.parse(stdout)
  return parsed.sha
}

async function createCommit(repo: string, treeSha: string, parentSha: string): Promise<string> {
  const stdout = await runGh([
    "api",
    `repos/${repo}/git/commits`,
    "--method",
    "POST",
    "-f",
    `message=eval fixture commit`,
    "-f",
    `tree=${treeSha}`,
    "-f",
    `parents[]=${parentSha}`,
  ])
  const parsed: { sha: string } = JSON.parse(stdout)
  return parsed.sha
}

async function createBranchRef(repo: string, branchName: string, commitSha: string): Promise<void> {
  await runGh([
    "api",
    `repos/${repo}/git/refs`,
    "--method",
    "POST",
    "-f",
    `ref=refs/heads/${branchName}`,
    "-f",
    `sha=${commitSha}`,
  ])
}

async function openPr(
  repo: string,
  branchName: string,
  name: string,
  labels: readonly string[],
  token?: string,
): Promise<void> {
  const args = [
    "pr",
    "create",
    "--repo",
    repo,
    "--head",
    branchName,
    "--title",
    `[eval] ${name}`,
    "--body",
    `Auto-generated eval fixture: ${name}`,
  ]
  for (const label of labels) {
    args.push("--label", label)
  }
  if (token) {
    await runGhWithToken(args, token)
  } else {
    await runGh(args)
  }
}

async function getPrDetails(
  repo: string,
  branchName: string,
): Promise<{ number: number; headRefOid: string }> {
  const stdout = await runGh([
    "pr",
    "view",
    branchName,
    "--repo",
    repo,
    "--json",
    "number,headRefOid",
  ])
  return JSON.parse(stdout) as { number: number; headRefOid: string }
}

/** Creates a {@link FixtureSeeder} that provisions pull requests via the `gh` CLI. */
export function createPrSeeder(): FixtureSeeder {
  return {
    type: "pr",

    async seed(options: SeedOptions): Promise<FixtureResource> {
      const { repo, name, labels, botToken } = options
      const branchName = `bench-fixture/${name}-${Date.now()}`

      const defaultBranch = await getDefaultBranch(repo)
      const headSha = await getHeadSha(repo, defaultBranch)
      const treeSha = await createTree(repo, headSha)
      const commitSha = await createCommit(repo, treeSha, headSha)
      await createBranchRef(repo, branchName, commitSha)
      await openPr(repo, branchName, name, labels, botToken)
      const prDetails = await getPrDetails(repo, branchName)

      return {
        type: "pr",
        number: prDetails.number,
        repo,
        branch: branchName,
        labels: [...labels],
        metadata: { originalSha: headSha },
      }
    },
  }
}

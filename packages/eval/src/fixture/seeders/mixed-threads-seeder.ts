import type { FixtureResource } from "@eval/fixture/manifest.js"
import type { FixtureSeeder, SeedOptions } from "@eval/fixture/seeders/types.js"
import { runGh, runGhWithToken } from "./gh.js"

const FILE_PATH = "src/utils/mixed-helpers.ts"

const FILE_CONTENT = `// Mixed-state helpers for data processing
export function processData(items: any[]) {
  return items.map(item => item.value)
}

export function filterActive(items: any[]) {
  return items.filter(item => item.active)
}

export function computeSum(numbers: any[]) {
  return numbers.reduce((a, b) => a + b, 0)
}

export function formatOutput(data: any) {
  return JSON.stringify(data)
}

export function parseInput(raw: string) {
  return JSON.parse(raw)
}

export function validateSchema(data: any, schema: any) {
  return true
}
`

// 6 inline review comments targeting specific lines in FILE_CONTENT
const REVIEW_COMMENTS = [
  { line: 2, body: "Avoid `any[]` — define a typed interface instead." },
  { line: 6, body: "Use a proper type for `items` parameter rather than `any[]`." },
  { line: 10, body: "Replace `any[]` with `number[]` since only numbers are summed here." },
  { line: 14, body: "The `data` parameter should be typed — avoid `any`." },
  { line: 18, body: "Add error handling around `JSON.parse` — it throws on invalid input." },
  {
    line: 22,
    body: "This function always returns `true` — implement real validation or remove it.",
  },
]

async function getHeadSha(repo: string, branch: string): Promise<string> {
  const stdout = await runGh(["api", `repos/${repo}/git/refs/heads/${branch}`])
  const parsed: { object: { sha: string } } = JSON.parse(stdout)
  return parsed.object.sha
}

async function getDefaultBranch(repo: string): Promise<string> {
  const stdout = await runGh(["api", `repos/${repo}`, "--jq", ".default_branch"])
  return stdout.trim()
}

async function createBranch(repo: string, branchName: string, baseSha: string): Promise<void> {
  await runGh([
    "api",
    `repos/${repo}/git/refs`,
    "--method",
    "POST",
    "-f",
    `ref=refs/heads/${branchName}`,
    "-f",
    `sha=${baseSha}`,
  ])
}

async function upsertFile(
  repo: string,
  branch: string,
  path: string,
  content: string,
  message: string,
): Promise<void> {
  const encoded = Buffer.from(content, "utf8").toString("base64")

  // Check if file already exists on this branch
  let existingSha: string | undefined
  try {
    const existing = await runGh(["api", `repos/${repo}/contents/${path}?ref=${branch}`])
    const parsed: { sha?: string } = JSON.parse(existing)
    if (typeof parsed.sha === "string") existingSha = parsed.sha
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes("404")) {
      throw new Error(`Failed to inspect existing file "${path}" on ${repo}@${branch}: ${message}`)
    }
    // 404 = file does not exist yet
  }

  const args = [
    "api",
    `repos/${repo}/contents/${path}`,
    "--method",
    "PUT",
    "-f",
    `message=${message}`,
    "-f",
    `content=${encoded}`,
    "-f",
    `branch=${branch}`,
  ]
  if (existingSha) {
    args.push("-f", `sha=${existingSha}`)
  }
  await runGh(args)
}

async function openPr(
  repo: string,
  branchName: string,
  baseBranch: string,
  name: string,
  labels: readonly string[],
): Promise<number> {
  const result = await runGh([
    "api",
    `repos/${repo}/pulls`,
    "--method",
    "POST",
    "-f",
    `title=[eval] ${name}`,
    "-f",
    "body=Auto-generated eval fixture with review comments.",
    "-f",
    `head=${branchName}`,
    "-f",
    `base=${baseBranch}`,
    "--jq",
    ".number",
  ])
  const prNumber = parseInt(result.trim(), 10)
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    throw new Error(`Failed to create PR — unexpected number: ${result}`)
  }

  // Apply labels
  if (labels.length > 0) {
    const labelArgs = ["api", `repos/${repo}/issues/${prNumber}/labels`, "--method", "POST"]
    for (const label of labels) {
      labelArgs.push("-f", `labels[]=${label}`)
    }
    await runGh(labelArgs)
  }

  return prNumber
}

async function postReviewComments(
  repo: string,
  prNumber: number,
  headSha: string,
  token: string,
): Promise<void> {
  for (const comment of REVIEW_COMMENTS) {
    await runGhWithToken(
      [
        "api",
        `repos/${repo}/pulls/${prNumber}/comments`,
        "--method",
        "POST",
        "-f",
        `body=${comment.body}`,
        "-f",
        `commit_id=${headSha}`,
        "-f",
        `path=${FILE_PATH}`,
        "-F",
        `line=${comment.line}`,
        "-f",
        "side=RIGHT",
      ],
      token,
    )
  }
}

async function getThreadIds(repo: string, prNumber: number): Promise<string[]> {
  const [owner, name] = repo.split("/")
  const stdout = await runGh([
    "api",
    "graphql",
    "-f",
    `query=query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$num){reviewThreads(first:20){nodes{id}}}}}`,
    "-F",
    `owner=${owner}`,
    "-F",
    `repo=${name}`,
    "-F",
    `num=${prNumber}`,
  ])
  const parsed = JSON.parse(stdout) as {
    data: {
      repository: {
        pullRequest: { reviewThreads: { nodes: Array<{ id: string }> } }
      }
    }
  }
  return parsed.data.repository.pullRequest.reviewThreads.nodes.map((n) => n.id)
}

async function resolveThread(threadId: string, token: string): Promise<void> {
  await runGhWithToken(
    [
      "api",
      "graphql",
      "-f",
      `query=mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}`,
      "-F",
      `threadId=${threadId}`,
    ],
    token,
  )
}

/**
 * Creates a {@link FixtureSeeder} for `pr_with_mixed_threads`.
 *
 * - PR is opened by the main user (current `gh` CLI identity)
 * - Bot (`botToken`) posts 6 inline review comments
 * - Bot resolves the first 3 threads; the remaining 3 stay unresolved
 */
export function createMixedThreadsSeeder(): FixtureSeeder {
  return {
    type: "pr_with_mixed_threads",

    async seed(options: SeedOptions): Promise<FixtureResource> {
      const { repo, name, labels, botToken } = options
      if (!botToken) {
        throw new Error(
          "mixed-threads seeder requires a bot token (BENCH_FIXTURE_GH_APP_CLIENT_ID + BENCH_FIXTURE_GH_APP_PRIVATE_KEY_PATH)",
        )
      }

      const branchName = `bench-fixture/${name}-${Date.now()}`
      const defaultBranch = await getDefaultBranch(repo)
      const baseSha = await getHeadSha(repo, defaultBranch)

      await createBranch(repo, branchName, baseSha)
      await upsertFile(repo, branchName, FILE_PATH, FILE_CONTENT, "feat: add mixed helpers")

      const prNumber = await openPr(repo, branchName, defaultBranch, name, labels)

      // Get the head SHA after the file commit
      const headSha = await getHeadSha(repo, branchName)

      // Bot posts all 6 review comments
      await postReviewComments(repo, prNumber, headSha, botToken)

      // Fetch the thread IDs created by the review comments
      const threadIds = await getThreadIds(repo, prNumber)

      // Bot resolves the first 3 threads
      const resolveCount = Math.min(3, threadIds.length)
      for (let i = 0; i < resolveCount; i++) {
        const id = threadIds[i]
        if (id) await resolveThread(id, botToken)
      }

      return {
        type: "pr",
        number: prNumber,
        repo,
        branch: branchName,
        labels: [...labels],
        metadata: {
          originalSha: baseSha,
          resolvedThreads: resolveCount,
          unresolvedThreads: threadIds.length - resolveCount,
        },
      }
    },
  }
}

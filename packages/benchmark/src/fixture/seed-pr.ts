import { runGhJson, tryRunGh, tryRunGhJson, tryRunGhWithToken } from "./gh-client.js"

function parseRepo(repo: string): { owner: string; name: string } {
  const parts = repo.split("/")
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`invalid repo format: ${repo}; expected owner/name`)
  }

  const [owner, name] = parts

  return { owner, name }
}

function parseArrayResponse(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === "object" && value !== null) {
    const items = (value as { items?: unknown[] }).items
    if (Array.isArray(items)) {
      return items
    }

    const projects = (value as { projects?: unknown[] }).projects
    if (Array.isArray(projects)) {
      return projects
    }

    const nodes = (value as { nodes?: unknown[] }).nodes
    if (Array.isArray(nodes)) {
      return nodes
    }

    const fields = (value as { fields?: unknown[] }).fields
    if (Array.isArray(fields)) {
      return fields
    }
  }

  return []
}

export function findSeededPr(
  repo: string,
  seedLabel: string,
): { id: string; number: number } | null {
  const listResult = tryRunGhJson([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--label",
    "bench-fixture",
    "--label",
    seedLabel,
    "--limit",
    "1",
    "--json",
    "id,number",
  ])

  const list = parseArrayResponse(listResult)
  const first = list[0]
  if (typeof first !== "object" || first === null) {
    return null
  }

  const pr = first as Record<string, unknown>
  if (typeof pr.id !== "string" || typeof pr.number !== "number") {
    return null
  }

  return {
    id: pr.id,
    number: pr.number,
  }
}

export function createSeedPr(
  repo: string,
  seedId: string,
  seedLabel: string,
): { id: string; number: number } {
  const { owner, name } = parseRepo(repo)
  const branch = `bench-seed-${seedId}`
  const contentPath = `.bench/seed-${seedId}.md`

  const refResult = runGhJson(["api", `repos/${owner}/${name}/git/ref/heads/main`]) as Record<
    string,
    unknown
  >
  const object = refResult.object as Record<string, unknown>
  const baseSha = String(object.sha ?? "")
  if (baseSha.length === 0) {
    throw new Error("unable to resolve base sha for fixture PR creation")
  }

  tryRunGhJson([
    "api",
    `repos/${owner}/${name}/git/refs`,
    "--method",
    "POST",
    "-f",
    `ref=refs/heads/${branch}`,
    "-f",
    `sha=${baseSha}`,
  ])

  const body = `# Benchmark fixture seed\nseed: ${seedId}\n`
  const encodedBody = Buffer.from(body, "utf8").toString("base64")

  const existingFile = tryRunGhJson<{ sha?: string }>([
    "api",
    `repos/${owner}/${name}/contents/${contentPath}?ref=${branch}`,
  ])
  const existingFileSha =
    typeof existingFile?.sha === "string" && existingFile.sha.length > 0 ? existingFile.sha : null

  const contentArgs = [
    "api",
    `repos/${owner}/${name}/contents/${contentPath}`,
    "--method",
    "PUT",
    "-f",
    `message=chore: seed fixtures (${seedId})`,
    "-f",
    `content=${encodedBody}`,
    "-f",
    `branch=${branch}`,
  ]
  if (existingFileSha) {
    contentArgs.push("-f", `sha=${existingFileSha}`)
  }

  runGhJson(contentArgs)

  const existingPrResult = tryRunGhJson([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--head",
    branch,
    "--limit",
    "1",
    "--json",
    "id,number",
  ])

  const existingPrs = parseArrayResponse(existingPrResult)
  const existingPr = existingPrs[0]
  if (typeof existingPr === "object" && existingPr !== null) {
    const value = existingPr as Record<string, unknown>
    if (typeof value.id === "string" && typeof value.number === "number") {
      return {
        id: value.id,
        number: value.number,
      }
    }
  }

  const prResult = runGhJson([
    "api",
    `repos/${owner}/${name}/pulls`,
    "--method",
    "POST",
    "-f",
    `title=Benchmark fixture PR (${seedLabel})`,
    "-f",
    "body=Managed by benchmark fixture seeding.",
    "-f",
    `head=${branch}`,
    "-f",
    "base=main",
  ]) as Record<string, unknown>

  const number = Number(prResult.number)
  const nodeId = String(prResult.node_id ?? "")

  if (!Number.isInteger(number) || number <= 0 || nodeId.length === 0) {
    throw new Error("failed to create fixture PR")
  }

  tryRunGh([
    "api",
    `repos/${owner}/${name}/issues/${number}/labels`,
    "--method",
    "POST",
    "-f",
    "labels[]=bench-fixture",
    "-f",
    `labels[]=${seedLabel}`,
  ])

  return {
    id: nodeId,
    number,
  }
}

function getPrHeadSha(repo: string, prNumber: number): string | null {
  const result = tryRunGhJson([
    "pr",
    "view",
    String(prNumber),
    "--repo",
    repo,
    "--json",
    "headRefOid",
  ])
  if (typeof result !== "object" || result === null) {
    return null
  }

  const sha = (result as { headRefOid?: unknown }).headRefOid
  return typeof sha === "string" && sha.length > 0 ? sha : null
}

function findPrThreadId(repo: string, prNumber: number): string | null {
  const { owner, name } = parseRepo(repo)
  const result = tryRunGhJson([
    "api",
    "graphql",
    "-f",
    "query=query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$num){reviewThreads(first:20){nodes{id}}}}}",
    "-F",
    `owner=${owner}`,
    "-F",
    `repo=${name}`,
    "-F",
    `num=${prNumber}`,
  ])

  if (typeof result !== "object" || result === null) {
    return null
  }

  const nodes = (
    ((result as { data?: unknown }).data as { repository?: unknown } | undefined)?.repository as
      | {
          pullRequest?: unknown
        }
      | undefined
  )?.pullRequest as { reviewThreads?: unknown } | undefined

  const threadNodes = parseArrayResponse((nodes?.reviewThreads ?? {}) as unknown)
  const first = threadNodes[0]
  if (typeof first !== "object" || first === null) {
    return null
  }

  const id = (first as { id?: unknown }).id
  return typeof id === "string" && id.length > 0 ? id : null
}

function getAllPrThreadIds(repo: string, prNumber: number): string[] {
  const { owner, name } = parseRepo(repo)
  const result = tryRunGhJson([
    "api",
    "graphql",
    "-f",
    "query=query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$num){reviewThreads(first:20){nodes{id}}}}}",
    "-F",
    `owner=${owner}`,
    "-F",
    `repo=${name}`,
    "-F",
    `num=${prNumber}`,
  ])

  if (typeof result !== "object" || result === null) {
    return []
  }

  const nodes = (
    ((result as { data?: unknown }).data as { repository?: unknown } | undefined)?.repository as
      | { pullRequest?: unknown }
      | undefined
  )?.pullRequest as { reviewThreads?: unknown } | undefined

  const threadNodes = parseArrayResponse((nodes?.reviewThreads ?? {}) as unknown)
  return threadNodes
    .filter(
      (node): node is { id: string } =>
        typeof node === "object" &&
        node !== null &&
        typeof (node as { id?: unknown }).id === "string",
    )
    .map((node) => node.id)
}

export function resetPrReviewThreads(repo: string, prNumber: number, reviewerToken: string): void {
  const threadIds = getAllPrThreadIds(repo, prNumber)

  for (const threadId of threadIds) {
    tryRunGhWithToken(
      [
        "api",
        "graphql",
        "-f",
        "query=mutation($threadId:ID!){unresolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}",
        "-F",
        `threadId=${threadId}`,
      ],
      reviewerToken,
    )
  }

  const firstThreadId = threadIds[0]
  if (firstThreadId) {
    tryRunGhWithToken(
      [
        "api",
        "graphql",
        "-f",
        "query=mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}",
        "-F",
        `threadId=${firstThreadId}`,
      ],
      reviewerToken,
    )
  }
}

function ensurePrThread(repo: string, prNumber: number, seedId: string): string {
  const existingThreadId = findPrThreadId(repo, prNumber)
  if (existingThreadId) {
    return existingThreadId
  }

  const headSha = getPrHeadSha(repo, prNumber)
  if (headSha) {
    const { owner, name } = parseRepo(repo)
    tryRunGh([
      "api",
      `repos/${owner}/${name}/pulls/${prNumber}/comments`,
      "--method",
      "POST",
      "-f",
      `body=Benchmark review thread seed (${seedId})`,
      "-f",
      `commit_id=${headSha}`,
      "-f",
      `path=.bench/seed-${seedId}.md`,
      "-F",
      "line=1",
      "-f",
      "side=RIGHT",
    ])
  }

  return findPrThreadId(repo, prNumber) ?? ""
}

type PrWithReviews = { id: string; number: number; thread_count: number }

const REVIEW_PR_FILE_PATH = "src/utils/helpers.ts"

const REVIEW_PR_FILE_CONTENT = `// Utility helpers for data processing
export function processItems(items: any[]) {
  let result = []
  for (let i = 0; i < items.length; i++) {
    if (items[i] != null) {
      result.push(items[i].name.toUpperCase())
    }
  }
  return result
}

export function fetchData(url: string) {
  // TODO: add error handling
  return fetch(url).then(res => res.json())
}

export function formatDate(d: Date) {
  return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate()
}
`

const REVIEW_COMMENTS = [
  {
    path: REVIEW_PR_FILE_PATH,
    line: 2,
    body: "Please use a proper type instead of `any[]`. Consider defining an `Item` interface with a `name: string` field.",
  },
  {
    path: REVIEW_PR_FILE_PATH,
    line: 3,
    body: "Use `const` instead of `let` since `result` is only pushed to, never reassigned. Also consider using `.filter().map()` instead of the imperative loop.",
  },
  {
    path: REVIEW_PR_FILE_PATH,
    line: 16,
    body: "This function has no error handling. Please add a try/catch and handle non-OK responses (check `res.ok` before calling `.json()`).",
  },
  {
    path: REVIEW_PR_FILE_PATH,
    line: 20,
    body: "`getMonth()` is zero-indexed, so January returns 0. Use `d.getMonth() + 1` and pad single digits with a leading zero for ISO format.",
  },
]

function countPrThreads(repo: string, prNumber: number): number {
  const { owner, name } = parseRepo(repo)
  const result = tryRunGhJson([
    "api",
    "graphql",
    "-f",
    "query=query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$num){reviewThreads(first:100){totalCount}}}}",
    "-F",
    `owner=${owner}`,
    "-F",
    `repo=${name}`,
    "-F",
    `num=${prNumber}`,
  ])

  if (typeof result !== "object" || result === null) {
    return 0
  }

  const data = (result as { data?: unknown }).data as Record<string, unknown> | undefined
  const repository = data?.repository as Record<string, unknown> | undefined
  const pullRequest = repository?.pullRequest as Record<string, unknown> | undefined
  const reviewThreads = pullRequest?.reviewThreads as Record<string, unknown> | undefined
  const totalCount = reviewThreads?.totalCount

  return typeof totalCount === "number" ? totalCount : 0
}

export function createPrWithReviews(
  repo: string,
  seedId: string,
  seedLabel: string,
  reviewerToken: string,
): PrWithReviews {
  const { owner, name } = parseRepo(repo)
  const branch = `bench-review-seed-${seedId}`

  const refResult = runGhJson(["api", `repos/${owner}/${name}/git/ref/heads/main`]) as Record<
    string,
    unknown
  >
  const object = refResult.object as Record<string, unknown>
  const baseSha = String(object.sha ?? "")
  if (baseSha.length === 0) {
    throw new Error("unable to resolve base sha for review PR creation")
  }

  tryRunGhJson([
    "api",
    `repos/${owner}/${name}/git/refs`,
    "--method",
    "POST",
    "-f",
    `ref=refs/heads/${branch}`,
    "-f",
    `sha=${baseSha}`,
  ])

  const encodedContent = Buffer.from(REVIEW_PR_FILE_CONTENT, "utf8").toString("base64")
  const existingFile = tryRunGhJson<{ sha?: string }>([
    "api",
    `repos/${owner}/${name}/contents/${REVIEW_PR_FILE_PATH}?ref=${branch}`,
  ])
  const existingFileSha =
    typeof existingFile?.sha === "string" && existingFile.sha.length > 0 ? existingFile.sha : null

  const contentArgs = [
    "api",
    `repos/${owner}/${name}/contents/${REVIEW_PR_FILE_PATH}`,
    "--method",
    "PUT",
    "-f",
    `message=feat: add utility helpers`,
    "-f",
    `content=${encodedContent}`,
    "-f",
    `branch=${branch}`,
  ]
  if (existingFileSha) {
    contentArgs.push("-f", `sha=${existingFileSha}`)
  }
  runGhJson(contentArgs)

  const existingPrResult = tryRunGhJson([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--head",
    branch,
    "--limit",
    "1",
    "--json",
    "id,number",
  ])
  const existingPrs = parseArrayResponse(existingPrResult)
  const existingPr = existingPrs[0]

  let prNumber: number
  let prNodeId: string

  if (
    typeof existingPr === "object" &&
    existingPr !== null &&
    typeof (existingPr as Record<string, unknown>).id === "string" &&
    typeof (existingPr as Record<string, unknown>).number === "number"
  ) {
    prNodeId = String((existingPr as Record<string, unknown>).id)
    prNumber = Number((existingPr as Record<string, unknown>).number)
  } else {
    const prResult = runGhJson([
      "api",
      `repos/${owner}/${name}/pulls`,
      "--method",
      "POST",
      "-f",
      `title=Add utility helpers (${seedLabel})`,
      "-f",
      "body=Adds data processing utility functions. Please review.",
      "-f",
      `head=${branch}`,
      "-f",
      "base=main",
    ]) as Record<string, unknown>

    prNumber = Number(prResult.number)
    prNodeId = String(prResult.node_id ?? "")

    if (!Number.isInteger(prNumber) || prNumber <= 0 || prNodeId.length === 0) {
      throw new Error("failed to create review fixture PR")
    }

    tryRunGh([
      "api",
      `repos/${owner}/${name}/issues/${prNumber}/labels`,
      "--method",
      "POST",
      "-f",
      "labels[]=bench-fixture",
      "-f",
      `labels[]=${seedLabel}`,
    ])
  }

  const headSha = getPrHeadSha(repo, prNumber)
  if (!headSha) {
    throw new Error("unable to resolve head sha for review comments")
  }

  const existingThreadCount = countPrThreads(repo, prNumber)
  let addedThreads = 0
  if (existingThreadCount < REVIEW_COMMENTS.length) {
    for (const comment of REVIEW_COMMENTS.slice(existingThreadCount)) {
      const created = tryRunGhWithToken(
        [
          "api",
          `repos/${owner}/${name}/pulls/${prNumber}/comments`,
          "--method",
          "POST",
          "-f",
          `body=${comment.body}`,
          "-f",
          `commit_id=${headSha}`,
          "-f",
          `path=${comment.path}`,
          "-F",
          `line=${comment.line}`,
          "-f",
          "side=RIGHT",
        ],
        reviewerToken,
      )
      if (created !== null) {
        addedThreads++
      }
    }
  }

  const firstThreadId = findPrThreadId(repo, prNumber)
  if (firstThreadId) {
    tryRunGhWithToken(
      [
        "api",
        "graphql",
        "-f",
        "query=mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}",
        "-F",
        `threadId=${firstThreadId}`,
      ],
      reviewerToken,
    )
  }

  return {
    id: prNodeId,
    number: prNumber,
    thread_count: existingThreadCount + addedThreads,
  }
}

type PrWithMixedThreads = {
  id: string
  number: number
  resolved_count: number
  unresolved_count: number
}

const MIXED_THREAD_FILE_PATH = "src/utils/mixed-helpers.ts"

const MIXED_THREAD_FILE_CONTENT = `// Mixed-state helpers for data processing
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

export function transformData(data: any[]) {
  return data
}
`

const MIXED_THREAD_COMMENTS = [
  {
    path: MIXED_THREAD_FILE_PATH,
    line: 2,
    body: "Avoid `any[]` — define a typed interface instead.",
  },
  {
    path: MIXED_THREAD_FILE_PATH,
    line: 6,
    body: "Use a proper type for `items` parameter rather than `any[]`.",
  },
  {
    path: MIXED_THREAD_FILE_PATH,
    line: 10,
    body: "Replace `any[]` with a typed `number[]` since only numbers are summed.",
  },
  {
    path: MIXED_THREAD_FILE_PATH,
    line: 14,
    body: "The `data` parameter should be typed — avoid `any`.",
  },
  {
    path: MIXED_THREAD_FILE_PATH,
    line: 18,
    body: "Add error handling around `JSON.parse` — it throws on invalid input.",
  },
  {
    path: MIXED_THREAD_FILE_PATH,
    line: 22,
    body: "This function always returns `true` — implement real schema validation or remove it.",
  },
  {
    path: MIXED_THREAD_FILE_PATH,
    line: 26,
    body: "The `data` and return types should not be `any[]` — define a proper transform type.",
  },
]

function resolveThreadId(repo: string, prNumber: number, index: number): string | null {
  const { owner, name } = parseRepo(repo)
  const result = tryRunGhJson([
    "api",
    "graphql",
    "-f",
    "query=query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$num){reviewThreads(first:20){nodes{id}}}}}",
    "-F",
    `owner=${owner}`,
    "-F",
    `repo=${name}`,
    "-F",
    `num=${prNumber}`,
  ])

  if (typeof result !== "object" || result === null) {
    return null
  }

  const nodes = (
    ((result as { data?: unknown }).data as { repository?: unknown } | undefined)?.repository as
      | { pullRequest?: unknown }
      | undefined
  )?.pullRequest as { reviewThreads?: unknown } | undefined

  const threadNodes = parseArrayResponse((nodes?.reviewThreads ?? {}) as unknown)
  const node = threadNodes[index]
  if (typeof node !== "object" || node === null) {
    return null
  }
  const id = (node as { id?: unknown }).id
  return typeof id === "string" && id.length > 0 ? id : null
}

export function createPrWithMixedThreads(
  repo: string,
  seedId: string,
  seedLabel: string,
  reviewerToken: string,
): PrWithMixedThreads {
  const { owner, name } = parseRepo(repo)
  const branch = `bench-mixed-seed-${seedId}`

  const refResult = runGhJson(["api", `repos/${owner}/${name}/git/ref/heads/main`]) as Record<
    string,
    unknown
  >
  const object = refResult.object as Record<string, unknown>
  const baseSha = String(object.sha ?? "")
  if (baseSha.length === 0) {
    throw new Error("unable to resolve base sha for mixed-thread PR creation")
  }

  tryRunGhJson([
    "api",
    `repos/${owner}/${name}/git/refs`,
    "--method",
    "POST",
    "-f",
    `ref=refs/heads/${branch}`,
    "-f",
    `sha=${baseSha}`,
  ])

  const encodedContent = Buffer.from(MIXED_THREAD_FILE_CONTENT, "utf8").toString("base64")
  const existingFile = tryRunGhJson<{ sha?: string }>([
    "api",
    `repos/${owner}/${name}/contents/${MIXED_THREAD_FILE_PATH}?ref=${branch}`,
  ])
  const existingFileSha =
    typeof existingFile?.sha === "string" && existingFile.sha.length > 0 ? existingFile.sha : null

  const contentArgs = [
    "api",
    `repos/${owner}/${name}/contents/${MIXED_THREAD_FILE_PATH}`,
    "--method",
    "PUT",
    "-f",
    `message=feat: add mixed helpers`,
    "-f",
    `content=${encodedContent}`,
    "-f",
    `branch=${branch}`,
  ]
  if (existingFileSha) {
    contentArgs.push("-f", `sha=${existingFileSha}`)
  }
  runGhJson(contentArgs)

  const existingPrResult = tryRunGhJson([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--head",
    branch,
    "--limit",
    "1",
    "--json",
    "id,number",
  ])
  const existingPrs = parseArrayResponse(existingPrResult)
  const existingPr = existingPrs[0]

  let prNumber: number
  let prNodeId: string

  if (
    typeof existingPr === "object" &&
    existingPr !== null &&
    typeof (existingPr as Record<string, unknown>).id === "string" &&
    typeof (existingPr as Record<string, unknown>).number === "number"
  ) {
    prNodeId = String((existingPr as Record<string, unknown>).id)
    prNumber = Number((existingPr as Record<string, unknown>).number)
  } else {
    const prResult = runGhJson([
      "api",
      `repos/${owner}/${name}/pulls`,
      "--method",
      "POST",
      "-f",
      `title=Add mixed helpers (${seedLabel})`,
      "-f",
      "body=Adds mixed-state helpers. Please review.",
      "-f",
      `head=${branch}`,
      "-f",
      "base=main",
    ]) as Record<string, unknown>

    prNumber = Number(prResult.number)
    prNodeId = String(prResult.node_id ?? "")

    if (!Number.isInteger(prNumber) || prNumber <= 0 || prNodeId.length === 0) {
      throw new Error("failed to create mixed-thread fixture PR")
    }

    tryRunGh([
      "api",
      `repos/${owner}/${name}/issues/${prNumber}/labels`,
      "--method",
      "POST",
      "-f",
      "labels[]=bench-fixture",
      "-f",
      `labels[]=${seedLabel}`,
    ])
  }

  const headSha = getPrHeadSha(repo, prNumber)
  if (!headSha) {
    throw new Error("unable to resolve head sha for mixed-thread review comments")
  }

  const existingThreadCount = countPrThreads(repo, prNumber)
  let addedThreads = 0
  if (existingThreadCount < MIXED_THREAD_COMMENTS.length) {
    for (const comment of MIXED_THREAD_COMMENTS.slice(existingThreadCount)) {
      const created = tryRunGhWithToken(
        [
          "api",
          `repos/${owner}/${name}/pulls/${prNumber}/comments`,
          "--method",
          "POST",
          "-f",
          `body=${comment.body}`,
          "-f",
          `commit_id=${headSha}`,
          "-f",
          `path=${comment.path}`,
          "-F",
          `line=${comment.line}`,
          "-f",
          "side=RIGHT",
        ],
        reviewerToken,
      )
      if (created !== null) {
        addedThreads++
      }
    }
  }

  // Resolve the first 4 threads
  const totalThreads = existingThreadCount + addedThreads
  const resolveCount = Math.min(4, totalThreads)
  for (let i = 0; i < resolveCount; i++) {
    const threadId = resolveThreadId(repo, prNumber, i)
    if (threadId) {
      tryRunGhWithToken(
        [
          "api",
          "graphql",
          "-f",
          "query=mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}",
          "-F",
          `threadId=${threadId}`,
        ],
        reviewerToken,
      )
    }
  }

  return {
    id: prNodeId,
    number: prNumber,
    resolved_count: resolveCount,
    unresolved_count: Math.max(0, totalThreads - resolveCount),
  }
}

export function resetMixedPrThreads(repo: string, prNumber: number, token: string): void {
  const threadIds = getAllPrThreadIds(repo, prNumber)

  // Unresolve all 7 threads
  for (const threadId of threadIds) {
    tryRunGhWithToken(
      [
        "api",
        "graphql",
        "-f",
        "query=mutation($threadId:ID!){unresolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}",
        "-F",
        `threadId=${threadId}`,
      ],
      token,
    )
  }

  // Re-resolve the first 4
  for (let i = 0; i < Math.min(4, threadIds.length); i++) {
    const threadId = threadIds[i]
    if (threadId) {
      tryRunGhWithToken(
        [
          "api",
          "graphql",
          "-f",
          "query=mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}",
          "-F",
          `threadId=${threadId}`,
        ],
        token,
      )
    }
  }
}

export { ensurePrThread }

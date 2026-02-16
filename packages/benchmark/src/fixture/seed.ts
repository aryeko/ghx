import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"

import type { FixtureManifest } from "../domain/types.js"

type SeedOptions = {
  repo: string
  outFile: string
  seedId: string
}

function runGh(args: string[]): string {
  const result = spawnSync("gh", args, {
    encoding: "utf8"
  })

  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim()
    throw new Error(stderr.length > 0 ? stderr : `gh command failed: gh ${args.join(" ")}`)
  }

  return (result.stdout ?? "").trim()
}

function runGhJson(args: string[]): unknown {
  const output = runGh(args)
  if (output.length === 0) {
    return {}
  }

  return JSON.parse(output)
}

function parseRepo(repo: string): { owner: string; name: string } {
  const [owner, name] = repo.split("/")
  if (!owner || !name) {
    throw new Error(`invalid repo format: ${repo}; expected owner/name`)
  }

  return { owner, name }
}

function findOrCreateIssue(repo: string, seedLabel: string): { id: string; number: number; url: string } {
  const { owner, name } = parseRepo(repo)
  const listResult = runGhJson([
    "issue",
    "list",
    "--repo",
    repo,
    "--label",
    "bench-fixture",
    "--label",
    seedLabel,
    "--state",
    "open",
    "--limit",
    "1",
    "--json",
    "id,number,url"
  ])

  const existingItems = Array.isArray(listResult)
    ? listResult
    : Array.isArray((listResult as { [k: string]: unknown }).items)
      ? ((listResult as { items: unknown[] }).items ?? [])
      : []

  const existing = existingItems[0]
  if (typeof existing === "object" && existing !== null) {
    const issue = existing as Record<string, unknown>
    if (typeof issue.id === "string" && typeof issue.number === "number" && typeof issue.url === "string") {
      return {
        id: issue.id,
        number: issue.number,
        url: issue.url
      }
    }
  }

  const title = `Benchmark fixture issue (${seedLabel})`
  const createResult = runGhJson([
    "api",
    `repos/${owner}/${name}/issues`,
    "--method",
    "POST",
    "-f",
    `title=${title}`,
    "-f",
    "body=Managed by benchmark fixture seeding.",
    "-f",
    "labels[]=bench-fixture",
    "-f",
    `labels[]=${seedLabel}`
  ])

  const createdIssue = createResult as Record<string, unknown>

  return {
    id: String(createdIssue.id),
    number: Number(createdIssue.number),
    url: String(createdIssue.url)
  }
}

function findFirstOpenPr(repo: string): { id: string; number: number } | null {
  const listResult = runGhJson([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--limit",
    "1",
    "--json",
    "id,number"
  ])

  const list = Array.isArray(listResult)
    ? listResult
    : Array.isArray((listResult as { [k: string]: unknown }).items)
      ? ((listResult as { items: unknown[] }).items ?? [])
      : []

  const first = list[0]
  if (!first || typeof first !== "object") {
    return null
  }

  const pr = first as Record<string, unknown>
  if (typeof pr.id !== "string" || typeof pr.number !== "number") {
    return null
  }

  return {
    id: pr.id,
    number: pr.number
  }
}

function findLatestWorkflowRun(repo: string): { id: number; job_id: number | null } | null {
  const runResult = runGhJson([
    "run",
    "list",
    "--repo",
    repo,
    "--workflow",
    "ci.yml",
    "--limit",
    "1",
    "--json",
    "databaseId"
  ])

  const runs = Array.isArray(runResult)
    ? runResult
    : Array.isArray((runResult as { [k: string]: unknown }).items)
      ? ((runResult as { items: unknown[] }).items ?? [])
      : []
  const first = runs[0]
  if (!first || typeof first !== "object") {
    return null
  }

  const runId = Number((first as Record<string, unknown>).databaseId)
  if (!Number.isInteger(runId) || runId <= 0) {
    return null
  }

  const jobsResult = runGhJson([
    "run",
    "view",
    String(runId),
    "--repo",
    repo,
    "--json",
    "jobs"
  ])
  const jobs = Array.isArray((jobsResult as { jobs?: unknown[] }).jobs) ? (jobsResult as { jobs: unknown[] }).jobs : []
  const firstJob = jobs[0]
  const jobId =
    typeof firstJob === "object" && firstJob !== null && typeof (firstJob as Record<string, unknown>).databaseId === "number"
      ? Number((firstJob as Record<string, unknown>).databaseId)
      : null

  return {
    id: runId,
    job_id: jobId
  }
}

function findLatestDraftRelease(repo: string): { id: number; tag_name: string } | null {
  const { owner, name } = parseRepo(repo)
  const releasesResult = runGhJson(["api", `repos/${owner}/${name}/releases?per_page=20`])
  const releases = Array.isArray(releasesResult) ? releasesResult : []

  for (const item of releases) {
    if (typeof item !== "object" || item === null) {
      continue
    }
    const release = item as Record<string, unknown>
    if (release.draft === true && typeof release.id === "number" && typeof release.tag_name === "string") {
      return {
        id: release.id,
        tag_name: release.tag_name
      }
    }
  }

  return null
}

function findLatestProject(owner: string): { number: number; id: string } | null {
  const output = runGh(["project", "list", "--owner", owner, "--format", "json"])
  const parsed = JSON.parse(output)
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return null
  }
  const first = parsed[0]
  if (
    typeof first !== "object" ||
    first === null ||
    typeof (first as Record<string, unknown>).number !== "number" ||
    typeof (first as Record<string, unknown>).id !== "string"
  ) {
    return null
  }

  return {
    number: Number((first as Record<string, unknown>).number),
    id: String((first as Record<string, unknown>).id)
  }
}

function buildManifest(repo: string, seedId: string): FixtureManifest {
  const { owner, name } = parseRepo(repo)
  const seedLabel = `bench-seed:${seedId}`

  runGh(["label", "create", "bench-fixture", "--repo", repo, "--color", "5319E7", "--force"])
  runGh(["label", "create", seedLabel, "--repo", repo, "--color", "1D76DB", "--force"])

  const issue = findOrCreateIssue(repo, seedLabel)
  const blockerIssue = issue
  const parentIssue = issue
  const pr = findFirstOpenPr(repo)
  const workflowRun = findLatestWorkflowRun(repo)
  const release = findLatestDraftRelease(repo)
  const project = findLatestProject(owner)

  const manifest: FixtureManifest = {
    version: 1,
    repo: {
      owner,
      name,
      full_name: repo,
      default_branch: "main"
    },
    resources: {
      issue,
      blocker_issue: blockerIssue,
      parent_issue: parentIssue,
      pr: pr ?? {
        id: "",
        number: 1
      },
      pr_thread: {
        id: ""
      },
      workflow_run: workflowRun ?? {
        id: 1
      },
      workflow_job: {
        id: workflowRun?.job_id ?? 1
      },
      check_run: {
        id: workflowRun?.job_id ?? 1
      },
      release: release ?? {
        id: 1,
        tag_name: "v0.0.0-bench"
      },
      project: project ?? {
        number: 1,
        id: "",
        item_id: "",
        field_id: "",
        option_id: ""
      },
      metadata: {
        seed_id: seedId,
        generated_at: new Date().toISOString(),
        run_id: randomUUID()
      }
    }
  }

  return manifest
}

export async function seedFixtureManifest(options: SeedOptions): Promise<FixtureManifest> {
  const manifest = buildManifest(options.repo, options.seedId)
  await mkdir(dirname(options.outFile), { recursive: true })
  await writeFile(options.outFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  return manifest
}

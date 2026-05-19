import { createHash } from "node:crypto"
import { constants } from "node:fs"
import { access, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { getOperationCard } from "@core/core/registry/index.js"
import type { OperationCard } from "@core/core/registry/types.js"

const CACHE_VERSION = 1
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type RepoContext = {
  owner: string
  name: string
  remoteUrl?: string
  gitRoot?: string
  source: "cache" | "env" | "git"
}

type RepoContextCacheEntry = {
  version: 1
  owner: string
  name: string
  remoteUrl?: string
  gitRoot?: string
  updatedAt: string
}

type ResolveRepoContextOptions = {
  cwd?: string
  env?: NodeJS.ProcessEnv
}

type TaskStep = { task: string; input: Record<string, unknown> }

function cacheBaseDir(env: NodeJS.ProcessEnv): string {
  return env.XDG_CACHE_HOME || join(homedir(), ".cache")
}

function cacheKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32)
}

function cachePathFor(key: string, env: NodeJS.ProcessEnv): string {
  return join(cacheBaseDir(env), "ghx", "repos", `${cacheKey(key)}.json`)
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function findGitRoot(cwd: string): Promise<string | null> {
  let current = resolve(cwd)

  while (true) {
    if (await pathExists(join(current, ".git"))) {
      return current
    }

    const parent = dirname(current)
    if (parent === current) {
      return null
    }
    current = parent
  }
}

function parseGitdirFile(content: string, gitRoot: string): string | null {
  const match = /^gitdir:\s*(.+)$/m.exec(content)
  const raw = match?.[1]?.trim()
  if (!raw) {
    return null
  }
  return isAbsolute(raw) ? raw : resolve(gitRoot, raw)
}

async function resolveGitDir(gitRoot: string): Promise<string | null> {
  const dotGit = join(gitRoot, ".git")
  const dotGitStat = await stat(dotGit).catch(() => null)
  if (!dotGitStat) {
    return null
  }
  if (dotGitStat.isDirectory()) {
    return dotGit
  }
  if (!dotGitStat.isFile()) {
    return null
  }

  return parseGitdirFile(await readFile(dotGit, "utf8"), gitRoot)
}

async function gitConfigCandidates(gitRoot: string): Promise<string[]> {
  const gitDir = await resolveGitDir(gitRoot)
  if (!gitDir) {
    return []
  }

  const candidates = [join(gitDir, "config")]
  const commonDirRaw = await readFile(join(gitDir, "commondir"), "utf8").catch(() => null)
  const commonDir = commonDirRaw?.trim()
  if (commonDir) {
    const resolvedCommonDir = isAbsolute(commonDir) ? commonDir : resolve(gitDir, commonDir)
    candidates.push(join(resolvedCommonDir, "config"))
  }

  return [...new Set(candidates)]
}

function parseOriginRemoteUrl(config: string): string | null {
  let inOriginRemote = false

  for (const line of config.split(/\r?\n/)) {
    const section = /^\s*\[([^\]]+)\]\s*$/.exec(line)?.[1]
    if (section) {
      inOriginRemote = section === 'remote "origin"'
      continue
    }

    if (!inOriginRemote) {
      continue
    }

    const url = /^\s*url\s*=\s*(.+?)\s*$/.exec(line)?.[1]
    if (url) {
      return url
    }
  }

  return null
}

async function readOriginRemoteUrl(gitRoot: string): Promise<string | null> {
  for (const candidate of await gitConfigCandidates(gitRoot)) {
    const raw = await readFile(candidate, "utf8").catch(() => null)
    if (!raw) {
      continue
    }

    const remoteUrl = parseOriginRemoteUrl(raw)
    if (remoteUrl) {
      return remoteUrl
    }
  }

  return null
}

function parseOwnerNameFromRemoteUrl(remoteUrl: string): { owner: string; name: string } | null {
  const withoutTrailingSlash = remoteUrl.trim().replace(/\/+$/, "")
  const sshMatch = /[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/.exec(withoutTrailingSlash)
  if (!sshMatch) {
    return null
  }

  const [, owner, name] = sshMatch
  if (!owner || !name) {
    return null
  }

  return { owner, name }
}

function parseOwnerNameFromEnvRepository(raw: string | undefined): {
  owner: string
  name: string
} | null {
  const match = /^([^/\s]+)\/([^/\s]+)$/.exec(raw?.trim() ?? "")
  if (!match?.[1] || !match[2]) {
    return null
  }
  return { owner: match[1], name: match[2] }
}

function isFresh(entry: RepoContextCacheEntry): boolean {
  const updatedAtMs = Date.parse(entry.updatedAt)
  return Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs <= CACHE_TTL_MS
}

function isCacheEntry(value: unknown): value is RepoContextCacheEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as RepoContextCacheEntry).version === CACHE_VERSION &&
    typeof (value as RepoContextCacheEntry).owner === "string" &&
    typeof (value as RepoContextCacheEntry).name === "string" &&
    typeof (value as RepoContextCacheEntry).updatedAt === "string"
  )
}

async function readCachedRepoContext(
  key: string,
  env: NodeJS.ProcessEnv,
): Promise<RepoContext | null> {
  const raw = await readFile(cachePathFor(key, env), "utf8").catch(() => null)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isCacheEntry(parsed) || !isFresh(parsed)) {
      return null
    }
    return {
      owner: parsed.owner,
      name: parsed.name,
      ...(parsed.remoteUrl ? { remoteUrl: parsed.remoteUrl } : {}),
      ...(parsed.gitRoot ? { gitRoot: parsed.gitRoot } : {}),
      source: "cache",
    }
  } catch {
    return null
  }
}

async function writeCachedRepoContext(
  key: string,
  context: Omit<RepoContextCacheEntry, "updatedAt" | "version">,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  const path = cachePathFor(key, env)
  const tmpPath = `${path}.${process.pid}.tmp`
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(
    tmpPath,
    JSON.stringify({ version: CACHE_VERSION, ...context, updatedAt: new Date().toISOString() }),
    { mode: 0o600 },
  )
  await rename(tmpPath, path)
}

export async function resolveRepoContext(
  options: ResolveRepoContextOptions = {},
): Promise<RepoContext | null> {
  const env = options.env ?? process.env
  const cwd = options.cwd ?? process.cwd()
  const gitRoot = await findGitRoot(cwd)
  const key = gitRoot ?? `env:${env.GITHUB_REPOSITORY ?? ""}`

  if (key !== "env:") {
    const cached = await readCachedRepoContext(key, env)
    if (cached) {
      return cached
    }
  }

  if (gitRoot) {
    const remoteUrl = await readOriginRemoteUrl(gitRoot)
    const parsed = remoteUrl ? parseOwnerNameFromRemoteUrl(remoteUrl) : null
    if (remoteUrl && parsed) {
      const context: RepoContext = { ...parsed, remoteUrl, gitRoot, source: "git" }
      await writeCachedRepoContext(gitRoot, context, env).catch(() => {})
      return context
    }
  }

  const envRepo = parseOwnerNameFromEnvRepository(env.GITHUB_REPOSITORY)
  if (envRepo) {
    const context: RepoContext = { ...envRepo, source: "env" }
    await writeCachedRepoContext(`env:${env.GITHUB_REPOSITORY}`, context, env).catch(() => {})
    return context
  }

  return null
}

function hasOwnerNameSchema(card: OperationCard | undefined): boolean {
  const properties = card?.input_schema.properties
  return (
    typeof properties === "object" &&
    properties !== null &&
    "owner" in properties &&
    "name" in properties
  )
}

function hasUsableString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function needsRepoContext(task: string, input: Record<string, unknown>): boolean {
  const card = getOperationCard(task)
  return hasOwnerNameSchema(card) && (!hasUsableString(input.owner) || !hasUsableString(input.name))
}

function applyContext(
  input: Record<string, unknown>,
  context: RepoContext,
): Record<string, unknown> {
  return {
    ...input,
    ...(!hasUsableString(input.owner) ? { owner: context.owner } : {}),
    ...(!hasUsableString(input.name) ? { name: context.name } : {}),
  }
}

export async function applyRepoContextDefaultsToInput(
  task: string,
  input: Record<string, unknown>,
  options: ResolveRepoContextOptions = {},
): Promise<Record<string, unknown>> {
  if (!needsRepoContext(task, input)) {
    return input
  }

  const context = await resolveRepoContext(options)
  return context ? applyContext(input, context) : input
}

export async function applyRepoContextDefaultsToSteps(
  steps: TaskStep[],
  options: ResolveRepoContextOptions = {},
): Promise<TaskStep[]> {
  let context: RepoContext | null | undefined

  const output: TaskStep[] = []
  for (const step of steps) {
    if (!needsRepoContext(step.task, step.input)) {
      output.push(step)
      continue
    }

    context ??= await resolveRepoContext(options)
    output.push({
      ...step,
      input: context ? applyContext(step.input, context) : step.input,
    })
  }

  return output
}

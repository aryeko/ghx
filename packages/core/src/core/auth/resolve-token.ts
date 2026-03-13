import { statSync } from "node:fs"
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { createSafeCliCommandRunner } from "@core/core/execution/cli/safe-runner.js"

export type TokenResolution = {
  token: string
  source: "env" | "cache" | "gh-cli"
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const GH_AUTH_TIMEOUT_MS = 5_000

function resolveHostname(): string {
  return process.env.GH_HOST || "github.com"
}

function resolveCacheDir(): string {
  const base = process.env.XDG_CACHE_HOME || join(homedir(), ".cache")
  return join(base, "ghx", "tokens")
}

function resolveCachePath(): string {
  return join(resolveCacheDir(), resolveHostname())
}

async function readCachedToken(): Promise<string | null> {
  const cachePath = resolveCachePath()
  try {
    const stat = statSync(cachePath)
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) {
      return null
    }
  } catch {
    return null
  }

  try {
    const content = await readFile(cachePath, "utf8")
    const trimmed = content.trim()
    return trimmed.length > 0 ? trimmed : null
  } catch {
    return null
  }
}

async function writeCachedToken(token: string): Promise<void> {
  const cacheDir = resolveCacheDir()
  const cachePath = resolveCachePath()
  const tmpPath = `${cachePath}.${process.pid}.tmp`

  await mkdir(cacheDir, { recursive: true, mode: 0o700 })
  await writeFile(tmpPath, token, { mode: 0o600 })
  await rename(tmpPath, cachePath)
}

async function resolveFromGhCli(): Promise<string | null> {
  const runner = createSafeCliCommandRunner()
  const hostname = resolveHostname()
  const args =
    hostname === "github.com" ? ["auth", "token"] : ["auth", "token", "--hostname", hostname]

  try {
    const result = await runner.run("gh", args, GH_AUTH_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      return null
    }
    const token = result.stdout.trim()
    return token.length > 0 ? token : null
  } catch {
    return null
  }
}

export async function resolveGithubToken(): Promise<TokenResolution> {
  const githubToken = process.env.GITHUB_TOKEN?.trim()
  if (githubToken && githubToken.length > 0) {
    return { token: githubToken, source: "env" }
  }

  const ghToken = process.env.GH_TOKEN?.trim()
  if (ghToken && ghToken.length > 0) {
    return { token: ghToken, source: "env" }
  }

  const cached = await readCachedToken()
  if (cached !== null) {
    return { token: cached, source: "cache" }
  }

  const ghCliToken = await resolveFromGhCli()
  if (ghCliToken !== null) {
    await writeCachedToken(ghCliToken).catch(() => {})
    return { token: ghCliToken, source: "gh-cli" }
  }

  throw new Error(
    "GitHub token not found. Set GITHUB_TOKEN or GH_TOKEN environment variable, or authenticate with: gh auth login",
  )
}

export async function invalidateTokenCache(): Promise<void> {
  try {
    await unlink(resolveCachePath())
  } catch {
    // No-op if file doesn't exist
  }
}

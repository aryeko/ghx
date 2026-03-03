import { createSign } from "node:crypto"
import { readFile } from "node:fs/promises"

const REQUEST_TIMEOUT_MS = 10_000

type AppAuthConfig = {
  clientId: string
  privateKey: string
}

function parseInlinePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n")
}

async function resolvePrivateKey(): Promise<string | null> {
  const inline = process.env["BENCH_FIXTURE_GH_APP_PRIVATE_KEY"]
  if (typeof inline === "string" && inline.trim().length > 0) {
    return parseInlinePrivateKey(inline)
  }

  const keyPath = process.env["BENCH_FIXTURE_GH_APP_PRIVATE_KEY_PATH"]
  if (typeof keyPath === "string" && keyPath.trim().length > 0) {
    return await readFile(keyPath, "utf8")
  }

  return null
}

async function resolveConfig(): Promise<AppAuthConfig | null> {
  const clientId = process.env["BENCH_FIXTURE_GH_APP_CLIENT_ID"]?.trim() ?? ""
  const privateKey = await resolvePrivateKey()

  if (clientId.length === 0 && privateKey === null) return null

  if (clientId.length === 0 || privateKey === null || privateKey.trim().length === 0) {
    throw new Error(
      "Incomplete fixture app auth: provide BENCH_FIXTURE_GH_APP_CLIENT_ID and " +
        "BENCH_FIXTURE_GH_APP_PRIVATE_KEY or BENCH_FIXTURE_GH_APP_PRIVATE_KEY_PATH",
    )
  }

  return { clientId, privateKey }
}

function buildJwt(clientId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(
    JSON.stringify({ iat: now - 60, exp: now + 600, iss: clientId }),
  ).toString("base64url")
  const data = `${header}.${payload}`
  const sig = createSign("RSA-SHA256").update(data).end().sign(privateKey).toString("base64url")
  return `${data}.${sig}`
}

async function discoverInstallationId(jwt: string, owner: string, repo: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/installation`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "ghx-eval-fixtures",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok)
    throw new Error(`Failed to get app installation for ${owner}/${repo} (${res.status})`)
  const data = (await res.json()) as { id?: unknown }
  if (typeof data.id !== "number") throw new Error(`No installation found for ${owner}/${repo}`)
  return String(data.id)
}

async function mintToken(config: AppAuthConfig, repo: string): Promise<string> {
  const [owner, repoName] = repo.split("/")
  if (!owner || !repoName) throw new Error(`Invalid repo format: "${repo}" — expected "owner/repo"`)

  const jwt = buildJwt(config.clientId, config.privateKey)
  const installationId = await discoverInstallationId(jwt, owner, repoName)

  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "ghx-eval-fixtures",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  )
  if (!res.ok) throw new Error(`Failed to mint fixture app token (${res.status})`)

  const payload = (await res.json()) as { token?: unknown }
  if (typeof payload.token !== "string" || payload.token.length === 0) {
    throw new Error("App token response missing token field")
  }
  return payload.token
}

/**
 * Mints a GitHub App installation token using the env vars:
 * - `BENCH_FIXTURE_GH_APP_CLIENT_ID`
 * - `BENCH_FIXTURE_GH_APP_PRIVATE_KEY_PATH` (or `BENCH_FIXTURE_GH_APP_PRIVATE_KEY` for inline PEM)
 *
 * Returns `null` when none of the env vars are set (app auth is unconfigured).
 *
 * @param repo - Full `"owner/repo"` string for the fixture repository. Used to look up the
 *               app installation via `GET /repos/{owner}/{repo}/installation`.
 */
export async function mintFixtureAppToken(repo: string): Promise<string | null> {
  const config = await resolveConfig()
  if (config === null) return null
  return mintToken(config, repo)
}

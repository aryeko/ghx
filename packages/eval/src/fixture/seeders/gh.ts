import { execFile, spawn } from "node:child_process"

/** Run `gh` with the given args and return trimmed stdout. */
export function runGh(args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("gh", args as string[], (error, stdout) => {
      if (error) {
        reject(error)
        return
      }
      resolve(stdout.trim())
    })
  })
}

/** Run `gh` with `input` piped to stdin (needed for JSON body payloads). */
export function runGhWithInput(args: readonly string[], input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("gh", args as string[], { stdio: ["pipe", "pipe", "pipe"] })
    let settled = false
    let stdout = ""
    let stderr = ""

    const finishReject = (error: Error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    const finishResolve = (value: string) => {
      if (settled) return
      settled = true
      resolve(value)
    }

    proc.on("error", (error) => {
      finishReject(error instanceof Error ? error : new Error(String(error)))
    })

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    proc.on("close", (code) => {
      if (code !== 0) {
        finishReject(new Error(stderr.trim() || `gh exited with code ${code}`))
      } else {
        finishResolve(stdout.trim())
      }
    })
    proc.stdin.write(input)
    proc.stdin.end()
  })
}

/**
 * Extracts the issue number from a `gh issue create` URL output.
 * The URL format is: `https://github.com/{owner}/{repo}/issues/{number}`
 */
export function parseIssueNumberFromUrl(url: string): number {
  const match = /\/issues\/(\d+)$/.exec(url)
  if (!match?.[1]) {
    throw new Error(`Could not parse issue number from URL: "${url}"`)
  }
  return Number.parseInt(match[1], 10)
}

/** Run `gh` as a different GitHub identity by overriding `GH_TOKEN`. */
export function runGhWithToken(args: readonly string[], token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "gh",
      args as string[],
      { env: { ...process.env, GH_TOKEN: token, GITHUB_TOKEN: token } },
      (error, stdout) => {
        if (error) {
          reject(error)
          return
        }
        resolve(stdout.trim())
      },
    )
  })
}

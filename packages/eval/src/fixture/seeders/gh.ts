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
    let stdout = ""
    let stderr = ""
    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr.trim() || `gh exited with code ${code}`))
      else resolve(stdout.trim())
    })
    proc.stdin.write(input)
    proc.stdin.end()
  })
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

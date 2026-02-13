import { pathToFileURL } from "node:url"

import { createGithubClient } from "../../../ghx-router/src/gql/client.js"
import { executeTask } from "../../../ghx-router/src/core/routing/engine.js"
import type { TaskRequest } from "../../../ghx-router/src/core/contracts/task.js"

function parseArgs(argv: string[]): { task: string; input: Record<string, unknown> } {
  const [command, task, ...rest] = argv
  if (command !== "run") {
    throw new Error("Usage: run <task> --input '<json>'")
  }
  if (!task || task.trim().length === 0) {
    throw new Error("Missing task")
  }

  const inputIndex = rest.findIndex((arg) => arg === "--input")
  const inlineInput = rest.find((arg) => arg.startsWith("--input="))
  const inputRaw =
    inputIndex >= 0
      ? rest[inputIndex + 1]
      : inlineInput
        ? inlineInput.slice("--input=".length)
        : undefined

  if (!inputRaw) {
    throw new Error("Missing --input JSON")
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(inputRaw)
  } catch {
    throw new Error("Invalid JSON for --input")
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("--input must be a JSON object")
  }

  return { task, input: parsed as Record<string, unknown> }
}

async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const { task, input } = parseArgs(argv)

  const githubClient = createGithubClient({
    async execute<TData>(): Promise<TData> {
      throw new Error("GraphQL transport unavailable in benchmark shim")
    }
  })

  const request: TaskRequest = {
    task,
    input
  }

  const result = await executeTask(request, {
    githubClient,
    githubToken: process.env.GITHUB_TOKEN ?? null
  })

  process.stdout.write(`${JSON.stringify(result)}\n`)
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exit(1)
  })
}

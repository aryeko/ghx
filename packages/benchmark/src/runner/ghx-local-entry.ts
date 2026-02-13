import { pathToFileURL } from "node:url"

import { createGithubClient } from "../../../ghx-router/src/gql/client.js"
import { executeTask } from "../../../ghx-router/src/core/routing/engine.js"
import type { TaskRequest } from "../../../ghx-router/src/core/contracts/task.js"

const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql"

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

function resolveGithubToken(): string {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  if (!token || token.trim().length === 0) {
    throw new Error("Missing GITHUB_TOKEN or GH_TOKEN for GraphQL transport")
  }

  return token
}

async function executeGraphqlRequest<TData>(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<TData> {
  const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "user-agent": "ghx-router-benchmark"
    },
    body: JSON.stringify({ query, variables: variables ?? {} })
  })

  const payload = (await response.json()) as {
    data?: TData
    errors?: Array<{ message?: string }>
    message?: string
  }

  if (!response.ok) {
    const message = payload.message ?? `GitHub GraphQL request failed with status ${response.status}`
    throw new Error(message)
  }

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const message = payload.errors[0]?.message ?? "GitHub GraphQL returned errors"
    throw new Error(message)
  }

  if (payload.data === undefined) {
    throw new Error("GitHub GraphQL response missing data")
  }

  return payload.data
}

async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const { task, input } = parseArgs(argv)
  const githubToken = resolveGithubToken()

  const githubClient = createGithubClient({
    async execute<TData>(query: string, variables?: Record<string, unknown>): Promise<TData> {
      return executeGraphqlRequest<TData>(githubToken, query, variables)
    }
  })

  const request: TaskRequest = {
    task,
    input
  }

  const result = await executeTask(request, {
    githubClient,
    githubToken
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

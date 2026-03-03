# Library Quickstart

Use `@ghx-dev/core` as a TypeScript library to execute GitHub operations with type safety, automatic routing, and a stable result envelope.

## Setup

```ts
import { createGithubClientFromToken, executeTask } from "@ghx-dev/core"

const token = process.env.GITHUB_TOKEN!
const githubClient = createGithubClientFromToken(token)
```

## Execute a Single Task

Every operation is a `TaskRequest` — a capability ID plus typed input:

```ts
const result = await executeTask(
  { task: "pr.view", input: { owner: "acme", name: "repo", number: 42 } },
  { githubClient, githubToken: token },
)

if (result.ok) {
  console.log(result.data.title)       // typed PR data
  console.log(result.meta.route_used)  // "graphql" or "cli"
} else {
  console.error(result.error.code)     // "NOT_FOUND", "AUTH", etc.
  console.log(result.error.retryable)  // boolean
}
```

> The `result` is always a [`ResultEnvelope`](../concepts/result-envelope.md) — never throws, never returns raw API payloads.

## Chain Multiple Tasks

Batch several operations into a single logical call with `executeTasks`:

```ts
import { executeTasks } from "@ghx-dev/core"

const chain = await executeTasks(
  [
    { task: "issue.labels.remove", input: { owner: "acme", name: "repo", issueNumber: 7, labels: ["triage"] } },
    { task: "issue.labels.add", input: { owner: "acme", name: "repo", issueNumber: 7, labels: ["bug", "p1"] } },
    { task: "issue.comments.create", input: { owner: "acme", name: "repo", issueNumber: 7, body: "Triaged." } },
  ],
  { githubClient, githubToken: token },
)

console.log(chain.status)          // "success" | "partial" | "failed"
console.log(chain.meta.succeeded)  // 3
for (const step of chain.results) {
  console.log(step.task, step.ok)
}
```

> Internally, ghx batches the GraphQL mutations into a single network request where possible. See [Chaining](../concepts/chaining.md).

## Discover Capabilities

```ts
import { listCapabilities, explainCapability } from "@ghx-dev/core"

// List all available capabilities
const caps = listCapabilities()
caps.forEach((c) => console.log(c.id, c.description))

// Get details about a specific capability
const info = explainCapability("pr.threads.list")
console.log(info.inputSchema)
console.log(info.routing)
```

## Custom GraphQL Transport

For enterprise endpoints, proxies, or testing, bring your own transport:

```ts
import { createGithubClient, executeTask } from "@ghx-dev/core"

const githubClient = createGithubClient({
  async execute<TData>(query: string, variables?: Record<string, unknown>): Promise<TData> {
    // your custom fetch logic here
    const res = await fetch("https://github.mycompany.com/api/graphql", { /* ... */ })
    return (await res.json()).data
  },
})
```

See the full guide: [Custom GraphQL Transport](../guides/custom-graphql-transport.md).

## Next Steps

- [Result Envelope](../concepts/result-envelope.md) — understand the `ok`/`error`/`meta` contract
- [Error Handling](../guides/error-handling.md) — retry patterns and error codes
- [API Reference](../reference/api.md) — all public exports

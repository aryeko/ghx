# Custom GraphQL Transport

By default, ghx uses `graphql-request` to send queries to GitHub's GraphQL API. You can replace this with your own transport for enterprise endpoints, proxies, request signing, or test mocking.

## The Transport Interface

```ts
interface GraphqlTransport {
  execute<TData>(query: string, variables?: Record<string, unknown>): Promise<TData>
}
```

One method. Receives a GraphQL query string and optional variables, returns the `data` field of the response.

## Basic Example: Enterprise Endpoint

```ts
import { createGithubClient, executeTask } from "@ghx-dev/core"

const githubClient = createGithubClient({
  async execute<TData>(query: string, variables?: Record<string, unknown>): Promise<TData> {
    const response = await fetch("https://github.mycompany.com/api/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
      body: JSON.stringify({ query, variables: variables ?? {} }),
    })

    const payload = (await response.json()) as {
      data?: TData
      errors?: Array<{ message?: string }>
    }

    if (payload.errors?.length) {
      throw new Error(payload.errors[0]?.message ?? "GraphQL error")
    }
    if (payload.data === undefined) {
      throw new Error("GraphQL response missing data")
    }
    return payload.data
  },
})

const result = await executeTask(
  { task: "repo.view", input: { owner: "acme", name: "repo" } },
  { githubClient, githubToken: process.env.GITHUB_TOKEN },
)
```

## With Request Logging

```ts
const githubClient = createGithubClient({
  async execute<TData>(query: string, variables?: Record<string, unknown>): Promise<TData> {
    const start = Date.now()
    console.log(`[GQL] Sending query (${query.slice(0, 50)}...)`)

    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
      body: JSON.stringify({ query, variables }),
    })

    const payload = await response.json()
    console.log(`[GQL] Response: ${Date.now() - start}ms`)

    if (payload.errors?.length) throw new Error(payload.errors[0]?.message)
    return payload.data
  },
})
```

## For Testing: Mock Transport

```ts
const mockTransport: GraphqlTransport = {
  async execute<TData>(query: string, variables?: Record<string, unknown>): Promise<TData> {
    // Return canned responses based on query content
    if (query.includes("RepoView")) {
      return {
        repository: { id: "R_123", name: "test-repo", nameWithOwner: "acme/test-repo" },
      } as TData
    }
    throw new Error(`Unmocked query: ${query.slice(0, 80)}`)
  },
}

const githubClient = createGithubClient(mockTransport)
```

## Notes

- The `githubToken` in `ExecutionDeps` is still needed for CLI fallback routes, even when using a custom transport
- Your transport must throw on errors — ghx's error mapping relies on catching exceptions
- For `GH_HOST`-based enterprise routing, the default transport handles this automatically; custom transports need to hardcode the endpoint

## Next Steps

- [GraphQL Layer Architecture](../architecture/graphql-layer.md) — how the transport fits into the stack
- [API Reference: createGithubClient](../reference/api.md)

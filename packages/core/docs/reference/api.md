# API Reference

All public exports from `@ghx-dev/core` (`src/index.ts`).

## Execution

### `executeTask(request, deps)`

Execute a single GitHub operation.

```ts
function executeTask(request: TaskRequest, deps: ExecutionDeps): Promise<ResultEnvelope>
```

| Parameter | Type | Description |
|---|---|---|
| `request` | `TaskRequest` | `{ task: string, input: Record<string, unknown> }` |
| `deps` | `ExecutionDeps` | Execution context (see below) |

**Returns**: `Promise<ResultEnvelope>` — never throws.

```ts
const result = await executeTask(
  { task: "repo.view", input: { owner: "aryeko", name: "ghx" } },
  { githubClient, githubToken: token },
)
```

---

### `executeTasks(requests, deps)`

Execute multiple operations in a single batch.

```ts
function executeTasks(
  requests: Array<{ task: string; input: Record<string, unknown> }>,
  deps: ExecutionDeps,
): Promise<ChainResultEnvelope>
```

Batches GraphQL operations into minimal network requests. Falls back to individual CLI execution for CLI-only capabilities.

```ts
const chain = await executeTasks(
  [
    { task: "issue.labels.add", input: { owner: "acme", name: "repo", issueNumber: 7, labels: ["bug"] } },
    { task: "issue.comments.create", input: { owner: "acme", name: "repo", issueNumber: 7, body: "Triaged." } },
  ],
  { githubClient, githubToken: token },
)
```

---

### `createExecuteTool(options)`

Create an execute tool suitable for agent integration.

```ts
function createExecuteTool(options: {
  executeTask: (request: TaskRequest) => Promise<ResultEnvelope>
}): { execute: (task: string, input: Record<string, unknown>) => Promise<ResultEnvelope> }
```

```ts
const tool = createExecuteTool({
  executeTask: (req) => executeTask(req, deps),
})
const result = await tool.execute("repo.view", { owner: "aryeko", name: "ghx" })
```

---

## Client Creation

### `createGithubClientFromToken(token, options?)`

Create a `GithubClient` using a GitHub token.

```ts
function createGithubClientFromToken(token: string, options?: TokenClientOptions): GithubClient
```

| Parameter | Type | Description |
|---|---|---|
| `token` | `string` | GitHub personal access token |
| `options.graphqlUrl` | `string?` | Custom GraphQL endpoint |

```ts
const client = createGithubClientFromToken(process.env.GITHUB_TOKEN!)
```

---

### `createGithubClient(transport)`

Create a `GithubClient` using a custom `GraphqlTransport`.

```ts
function createGithubClient(transport: GraphqlTransport): GithubClient
```

```ts
const client = createGithubClient({
  async execute<TData>(query: string, variables?: Record<string, unknown>): Promise<TData> {
    // custom transport logic
  },
})
```

→ See [Custom GraphQL Transport](../guides/custom-graphql-transport.md)

---

### `createGraphqlClient(transport)`

Create a lower-level `GraphqlClient` (query/mutate methods) from a transport.

```ts
function createGraphqlClient(transport: GraphqlTransport): GraphqlClient
```

---

## Registry

### `listCapabilities()`

List all available capabilities.

```ts
function listCapabilities(): CapabilityListItem[]
```

Returns an array of `{ id: string, description: string }`.

---

### `listOperationCards()`

List all registered operation cards with full metadata.

```ts
function listOperationCards(): OperationCard[]
```

---

### `getOperationCard(capabilityId)`

Get a specific operation card by capability ID.

```ts
function getOperationCard(capabilityId: string): OperationCard | undefined
```

---

### `explainCapability(capabilityId)`

Get a human-readable explanation of a capability.

```ts
function explainCapability(capabilityId: string): CapabilityExplanation | undefined
```

---

## CLI Runner

### `createSafeCliCommandRunner()`

Create a CLI command runner for executing `gh` commands.

```ts
function createSafeCliCommandRunner(): CliCommandRunner
```

---

## Resolution Cache

### `createResolutionCache(options?)`

Create a cache for Phase 1 resolution lookups in batch mode.

```ts
function createResolutionCache(options?: ResolutionCacheOptions): ResolutionCache
```

### `buildCacheKey(operationName, variables)`

Build a deterministic cache key for a resolution lookup.

```ts
function buildCacheKey(operationName: string, variables: Record<string, unknown>): string
```

---

## ExecutionDeps

The `deps` object passed to `executeTask` / `executeTasks`:

| Field | Type | Required | Description |
|---|---|---|---|
| `githubClient` | `GithubClient` | Yes | Created via `createGithubClientFromToken` |
| `githubToken` | `string` | Yes | Token for CLI fallback routes |
| `cliRunner` | `CliCommandRunner` | No | Custom CLI runner |
| `ghCliAvailable` | `boolean` | No | Override CLI availability detection |
| `ghAuthenticated` | `boolean` | No | Override CLI auth detection |
| `skipGhPreflight` | `boolean` | No | Skip CLI environment detection |
| `reason` | `RouteReasonCode` | No | Override route reason code |
| `resolutionCache` | `ResolutionCache` | No | Cache for batch resolution lookups |

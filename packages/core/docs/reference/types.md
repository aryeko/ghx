# Types Reference

Full type definitions for all exported interfaces and types from `@ghx-dev/core`.

## Core Contracts

### TaskRequest

```ts
type TaskId = string

interface TaskRequest<TInput = Record<string, unknown>> {
  task: TaskId
  input: TInput
}
```

### ResultEnvelope

```ts
interface ResultEnvelope<TData = unknown> {
  ok: boolean
  data?: TData
  error?: ResultError
  meta: ResultMeta
}
```

### ResultError

```ts
interface ResultError {
  code: ErrorCode
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}
```

### ResultMeta

```ts
interface ResultMeta {
  capability_id: string
  route_used?: RouteSource
  reason?: RouteReasonCode
  attempts?: AttemptMeta[]
  pagination?: {
    has_next_page?: boolean
    end_cursor?: string
    next?: unknown
  }
  timings?: {
    total_ms?: number
    adapter_ms?: number
  }
  cost?: {
    tokens_in?: number
    tokens_out?: number
  }
}
```

### AttemptMeta

```ts
interface AttemptMeta {
  route: RouteSource
  status: "success" | "error" | "skipped"
  error_code?: ErrorCode
  duration_ms?: number
}
```

### RouteSource

```ts
type RouteSource = "cli" | "rest" | "graphql"
```

### RouteReasonCode

```ts
type RouteReasonCode =
  | "CARD_PREFERRED"
  | "CARD_FALLBACK"
  | "SUITABILITY_OVERRIDE"
  | "CAPABILITY_LIMIT"
  | "DEFAULT_POLICY"
```

---

## Chain Types

### ChainResultEnvelope

```ts
interface ChainResultEnvelope {
  status: ChainStatus
  results: ChainStepResult[]
  meta: {
    route_used: RouteSource
    total: number
    succeeded: number
    failed: number
  }
}
```

### ChainStepResult

```ts
interface ChainStepResult {
  task: string
  ok: boolean
  data?: unknown
  error?: ResultError
}
```

### ChainStatus

```ts
type ChainStatus = "success" | "partial" | "failed"
```

---

## Operation Card

### OperationCard

```ts
interface OperationCard<Input = Record<string, unknown>> {
  capability_id: string
  version: string
  description: string
  input_schema: JsonSchema
  output_schema: JsonSchema
  routing: {
    preferred: RouteSource
    fallbacks: RouteSource[]
    suitability?: SuitabilityRule[]
    notes?: string[]
  }
  graphql?: {
    operationName: string
    operationType: "query" | "mutation"
    documentPath: string
    variables?: Record<string, string>
    limits?: { maxPageSize?: number }
    resolution?: ResolutionConfig
  }
  cli?: {
    command: string
    jsonFields?: string[]
    jq?: string
    limits?: { maxItemsPerCall?: number }
  }
  rest?: {
    endpoints: Array<{ method: string; path: string }>
  }
  examples?: Array<{
    title: string
    input: Input
  }>
}
```

### SuitabilityRule

```ts
interface SuitabilityRule {
  when: "always" | "env" | "params"
  predicate: string
  reason: string
}
```

### ResolutionConfig

```ts
interface ResolutionConfig {
  lookup: LookupSpec
  inject: InjectSpec[]
}

interface LookupSpec {
  operationName: string
  documentPath: string
  vars: Record<string, string>
}

type InjectSpec =
  | ScalarInject        // Extract one value via dot-path
  | MapArrayInject      // Map names to IDs from a list
  | InputPassthroughInject  // Pass input value directly
  | NullLiteralInject   // Inject null explicitly
```

---

## GraphQL

### GraphqlTransport

```ts
interface GraphqlTransport {
  execute<TData>(query: string, variables?: Record<string, unknown>): Promise<TData>
}
```

### GraphqlClient

```ts
interface GraphqlClient {
  query<TData>(document: string, variables?: Record<string, unknown>): Promise<TData>
  mutate<TData>(document: string, variables?: Record<string, unknown>): Promise<TData>
}
```

### GithubClient

```ts
interface GithubClient {
  fetchRepoView(input: RepoViewInput): Promise<RepoViewData>
  fetchIssueList(input: IssueListInput): Promise<IssueListData>
  createIssue(input: IssueCreateInput): Promise<IssueMutationData>
  // ... 50+ typed methods
  query(document: string, variables?: Record<string, unknown>): Promise<unknown>
}
```

### TokenClientOptions

```ts
interface TokenClientOptions {
  graphqlUrl?: string
}
```

---

## CLI

### CliCommandRunner

```ts
type CliCommandRunner = (
  args: string[],
) => Promise<{ stdout: string; stderr: string; exitCode: number }>
```

---

## Resolution Cache

### ResolutionCache

```ts
interface ResolutionCache {
  get(key: string): unknown | undefined
  set(key: string, value: unknown): void
}
```

### ResolutionCacheOptions

```ts
interface ResolutionCacheOptions {
  maxSize?: number
  ttlMs?: number
}
```

---

## Registry

### CapabilityListItem

```ts
interface CapabilityListItem {
  id: string
  description: string
}
```

### CapabilityExplanation

```ts
interface CapabilityExplanation {
  capabilityId: string
  description: string
  inputSchema: JsonSchema
  outputSchema: JsonSchema
  routing: OperationCard["routing"]
  examples?: OperationCard["examples"]
}
```

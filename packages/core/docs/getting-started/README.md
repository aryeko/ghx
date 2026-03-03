# Getting Started

## Why ghx?

AI agents instructed to "use `gh` CLI" for GitHub operations waste significant tokens on research, trial-and-error, and output parsing. **ghx eliminates this waste.**

```mermaid
sequenceDiagram
    participant Agent
    participant gh as gh CLI (raw)
    participant ghx as ghx
    participant GH as GitHub API

    rect rgb(255, 235, 235)
    Note over Agent,GH: ❌ Without ghx — trial and error
    Agent->>gh: gh pr view 42 --json ...?
    gh-->>Agent: error: unknown field
    Agent->>gh: gh pr view 42 --json title,body,state
    gh-->>Agent: raw JSON (unstructured)
    Agent->>Agent: parse + guess fields
    Agent->>gh: gh api graphql ...?
    gh-->>Agent: partial data
    Note right of Agent: 6+ calls, 4000+ tokens
    end

    rect rgb(235, 255, 235)
    Note over Agent,GH: ✅ With ghx — one deterministic call
    Agent->>ghx: executeTask("pr.view", {owner, name, number})
    ghx->>GH: optimal route (GraphQL or CLI)
    GH-->>ghx: response
    ghx-->>Agent: ResultEnvelope {ok, data, meta}
    Note right of Agent: 1 call, ~200 tokens
    end
```

### Benchmarked Results

Across 40 runs on standard PR and issue workflows:

| Metric | Improvement |
|---|---|
| Tool calls | **-55%** (PR review), **-47%** (issue triage) |
| Active tokens | **-88%** (PR review), **-41%** (thread resolution) |
| Latency | **-57%** (PR review), **-26%** (thread resolution) |
| Success rate | **100%** both modes |

## Prerequisites

- **Node.js 22+**
- **`gh` CLI** authenticated (`gh auth status`)
- **`GITHUB_TOKEN`** or **`GH_TOKEN`** environment variable

## Install

```bash
npm install @ghx-dev/core
```

<details>
<summary>Other package managers</summary>

```bash
pnpm add @ghx-dev/core
# or
yarn add @ghx-dev/core
```

</details>

## Your First Result (2 minutes)

### Option A: CLI

```bash
npx @ghx-dev/core run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

Output:

```json
{
  "ok": true,
  "data": {
    "id": "R_kgDOOx...",
    "name": "ghx",
    "nameWithOwner": "aryeko/ghx"
  },
  "meta": {
    "capability_id": "repo.view",
    "route_used": "graphql",
    "reason": "CARD_PREFERRED"
  }
}
```

### Option B: TypeScript

```ts
import { createGithubClientFromToken, executeTask } from "@ghx-dev/core"

const token = process.env.GITHUB_TOKEN!
const githubClient = createGithubClientFromToken(token)

const result = await executeTask(
  { task: "repo.view", input: { owner: "aryeko", name: "ghx" } },
  { githubClient, githubToken: token },
)

console.log(result.ok ? result.data : result.error)
```

```mermaid
sequenceDiagram
    participant Agent
    participant ghx as ghx
    participant GH as GitHub

    Note over Agent,GH: Use Case: PR Review Cycle
    Agent->>ghx: executeTask("pr.view", {owner, name, number: 42})
    ghx-->>Agent: {ok: true, data: {title, body, state, ...}}
    Agent->>ghx: executeTask("pr.threads.list", {owner, name, number: 42})
    ghx-->>Agent: {ok: true, data: [{path, body, isResolved}, ...]}
    Agent->>ghx: executeTask("pr.reviews.submit", {owner, name, number: 42, event: "COMMENT", body: "LGTM"})
    ghx-->>Agent: {ok: true, data: {id, state: "COMMENTED"}}
```

```mermaid
sequenceDiagram
    participant Agent
    participant ghx as ghx
    participant GH as GitHub

    Note over Agent,GH: Use Case: Issue Triage (chained)
    Agent->>ghx: executeTasks([<br/>  {task: "issue.labels.remove", input: {labels: ["triage"]}},<br/>  {task: "issue.labels.add", input: {labels: ["bug"]}},<br/>  {task: "issue.assignees.add", input: {assignees: ["alice"]}},<br/>  {task: "issue.comments.create", input: {body: "Triaged as bug."}}])
    ghx->>GH: batched GraphQL (single request)
    GH-->>ghx: all results
    ghx-->>Agent: ChainResultEnvelope {status: "success", results: [...]}
    Note right of Agent: 4 operations, 1 network call
```

## Next Steps

- [Library Quickstart](./library-quickstart.md) — deeper TypeScript usage
- [CLI Quickstart](./cli-quickstart.md) — all CLI commands
- [Agent Setup](./agent-setup.md) — wire ghx into your agent
- [Concepts: How ghx Works](../concepts/README.md) — understand the architecture

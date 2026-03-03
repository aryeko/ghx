# Architecture

System-level view of `@ghx-dev/core` — how the modules fit together and the dependency flow between them.

## Component Diagram

```mermaid
graph TB
    subgraph Public["Public API (src/index.ts)"]
        ET[executeTask / executeTasks]
        CC[createGithubClientFromToken]
        REG[listCapabilities / explainCapability]
        TOOL[createExecuteTool]
    end

    subgraph Core["core/"]
        direction TB
        CONTRACTS[contracts/<br/>ResultEnvelope, TaskRequest]
        REGISTRY[registry/<br/>70 Operation Cards + Schema Validation]
        ROUTING[routing/engine/<br/>Single + Batch Execution]
        EXEC[execution/<br/>Adapters: CLI + GraphQL]
        ERRORS[errors/<br/>Error Codes + Mapping]
        TELEM[telemetry/<br/>Structured Logging]
    end

    subgraph GQL["gql/"]
        TRANSPORT[transport.ts<br/>GraphqlTransport interface]
        CLIENT[github-client.ts<br/>GithubClient facade - 50+ methods]
        DOMAINS[domains/<br/>Issue, PR, Release, Repo, Project, Workflow]
        OPS[operations/<br/>147 .graphql files]
        BATCH[batch.ts<br/>Query batching]
    end

    subgraph CLI["cli/"]
        CMDS[commands/<br/>run, chain, capabilities, setup]
        FMT[formatters/<br/>Output formatting]
    end

    ET --> ROUTING
    CC --> CLIENT
    REG --> REGISTRY
    TOOL --> ET

    ROUTING --> REGISTRY
    ROUTING --> EXEC
    ROUTING --> ERRORS
    ROUTING --> TELEM
    ROUTING --> BATCH

    EXEC --> CLIENT
    EXEC --> DOMAINS

    CLIENT --> TRANSPORT
    DOMAINS --> OPS

    CMDS --> ET
    CMDS --> REG

    style Public fill:#4A90D9,color:#fff
    style CONTRACTS fill:#2ECC71,color:#fff
```

## Module Dependency Layers

```mermaid
graph BT
    L1["Layer 1: Contracts<br/>envelope.ts, task.ts"] --> L2
    L2["Layer 2: Registry<br/>Operation cards, schema validation"] --> L3
    L3["Layer 3: Execution<br/>CLI adapter, GraphQL adapter, normalizer"] --> L4
    L4["Layer 4: Routing Engine<br/>Single, batch, resolve, assemble"] --> L5
    L5["Layer 5: Public API<br/>executeTask, createGithubClient, etc."]
    L6["Layer 6: CLI<br/>run, chain, capabilities, setup"] --> L5

    SIDE1["errors/ (codes, mapping, retryability)"] -.-> L3
    SIDE2["telemetry/ (logger)"] -.-> L4
    SIDE3["gql/ (transport, client, domains)"] -.-> L3

    style L1 fill:#E8F5E9
    style L5 fill:#4A90D9,color:#fff
    style L6 fill:#7B1FA2,color:#fff
```

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Cards are YAML, not code** | Declarative, diffable, easy for non-TS contributors to modify |
| **Registry loads all cards at startup** | Zero cold-start latency per request |
| **GraphQL preferred by default** | More efficient, typed, batches well |
| **CLI as fallback** | Some operations (diffs, raw logs) are only available via CLI |
| **Preflight check before each route** | Fail fast — don't attempt GraphQL without a token |
| **Resolution phase in batch mode** | Reduce N lookups to 1 batched query |
| **Error normalization** | Every adapter maps raw errors to the same `ErrorCode` set |

## Source Layout

```
src/
├── index.ts              Public API re-exports
├── core/
│   ├── contracts/        ResultEnvelope, TaskRequest
│   ├── registry/         Operation cards + schema validation
│   │   └── cards/        70 YAML operation card files
│   ├── routing/          Route selection + execution engine
│   │   └── engine/       single.ts, batch.ts, resolve.ts, assemble.ts
│   ├── execution/        Adapter implementations
│   │   └── adapters/     cli-adapter.ts, graphql-adapter.ts
│   ├── errors/           Error codes, mapping, retryability
│   ├── execute/          Execute orchestration layer
│   └── telemetry/        Structured logging
├── gql/
│   ├── transport.ts      GraphqlTransport interface
│   ├── github-client.ts  GithubClient facade
│   ├── domains/          Domain-specific GQL handlers
│   ├── operations/       .graphql operation files
│   └── batch.ts          Query batching utilities
├── cli/
│   ├── commands/         CLI command implementations
│   └── formatters/       Output formatting
└── shared/               Constants, types, utils
```

## Deep Dives

- [Execution Pipeline](./execution-pipeline.md) — step-by-step walkthrough of how a single task executes
- [Adapters](./adapters.md) — CLI and GraphQL adapter internals
- [GraphQL Layer](./graphql-layer.md) — transport, client facade, codegen, batching

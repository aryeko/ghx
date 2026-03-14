# @ghx-dev/core Documentation

Welcome to the `@ghx-dev/core` documentation — a typed GitHub execution router that gives AI agents deterministic, token-efficient access to the GitHub API.

## Reading Paths

| You are…              | Start here |
|---|---|
| **New to ghx**        | [Getting Started](./getting-started/README.md) — install → first result in 2 min |
| **Integrating ghx**   | [Library Quickstart](./getting-started/library-quickstart.md) or [Agent Setup](./getting-started/agent-setup.md) |
| **Understanding internals** | [Concepts](./concepts/README.md) → [Architecture](./architecture/README.md) |
| **Looking something up**    | [API Reference](./reference/api.md) · [Capabilities](./reference/capabilities.md) · [CLI](./reference/cli.md) |
| **Contributing**      | [Contributing Guide](./contributing/README.md) · [Adding a Capability](./guides/adding-a-capability.md) |

## Documentation Map

```
docs/
├── getting-started/     Why ghx, install, CLI & library quickstart, agent setup
├── concepts/            How ghx works: operation cards, routing, result envelope, chaining
├── architecture/        System design, execution pipeline, adapters, GraphQL layer
├── guides/              Error handling, custom transport, adding capabilities, telemetry
├── reference/           API exports, 70+ capabilities, error codes, types, CLI commands
└── contributing/        Dev setup, testing, code style for core package
```

## Quick Links

- [Result Envelope Contract](./concepts/result-envelope.md)
- [All 70+ Capabilities](./reference/capabilities.md)
- [Operation Cards Explained](./concepts/operation-cards.md)
- [Routing Engine](./concepts/routing-engine.md)
- [Error Codes Reference](./reference/error-codes.md)
- [Custom GraphQL Transport](./guides/custom-graphql-transport.md)

# Adding a Capability

This guide walks you through adding a new capability to ghx — from the YAML operation card to the adapter handlers and tests.

## Checklist

- [ ] **1.** Write the YAML operation card
- [ ] **2.** Add the GraphQL operation (if applicable)
- [ ] **3.** Implement the GraphQL domain handler
- [ ] **4.** Implement the CLI handler (if applicable)
- [ ] **5.** Register the CLI handler
- [ ] **6.** Run codegen
- [ ] **7.** Write tests
- [ ] **8.** Verify

## Step 1: Write the Operation Card

Create a new YAML file in `src/core/registry/cards/`:

```yaml
# src/core/registry/cards/issue.pin.yaml
capability_id: issue.pin
version: "1.0.0"
description: Pin an issue to the repository.

input_schema:
  type: object
  required: [owner, name, issueNumber]
  properties:
    owner: { type: string, minLength: 1 }
    name: { type: string, minLength: 1 }
    issueNumber: { type: integer, minimum: 1 }
  additionalProperties: false

output_schema:
  type: object
  required: [id]
  properties:
    id: { type: string, minLength: 1 }
  additionalProperties: false

routing:
  preferred: graphql
  fallbacks: [cli]

graphql:
  operationName: IssuePinMutation
  operationType: mutation
  documentPath: src/gql/operations/issue-pin.graphql
  resolution:
    lookup:
      operationName: IssueLookup
      documentPath: src/gql/operations/lookups/issue-lookup.graphql
      vars: { owner: owner, name: name, number: issueNumber }
    inject:
      - target: issueId
        source: scalar
        path: repository.issue.id

cli:
  command: issue pin
```

> The card is loaded automatically at startup — no manual registration needed.

## Step 2: Add the GraphQL Operation

Create the `.graphql` file referenced by `documentPath`:

```graphql
# src/gql/operations/issue-pin.graphql
mutation IssuePinMutation($issueId: ID!) {
  pinIssue(input: { issueId: $issueId }) {
    issue {
      id
    }
  }
}
```

## Step 3: Implement the GraphQL Domain Handler

Add a handler in the appropriate domain module (e.g. `gql/domains/issue-mutations.ts`):

```ts
export function createIssuePinHandler(client: GithubClient) {
  return async (params: Record<string, unknown>) => {
    // The routing engine resolves issueId via the resolution config
    const result = await client.mutate(IssuePinMutationDocument, {
      issueId: params.issueId as string,
    })
    return { id: result.pinIssue.issue.id }
  }
}
```

Register it in `gql/capability-registry.ts`:

```ts
registry.set("issue.pin", createIssuePinHandler)
```

## Step 4: Implement the CLI Handler

If the card has a `cli` block, add a handler in `core/execution/adapters/cli/`:

```ts
// core/execution/adapters/cli/issue-pin.ts
export async function handleIssuePin(
  runner: CliCommandRunner,
  params: Record<string, unknown>,
): Promise<ResultEnvelope> {
  const { stdout, exitCode } = await runner([
    "issue", "pin",
    String(params.issueNumber),
    "-R", `${params.owner}/${params.name}`,
  ])
  // parse and normalize...
}
```

## Step 5: Register the CLI Handler

Add the capability ID to `CliCapabilityId` union in `cli-capability-adapter.ts` and register the handler in the CLI capability registry.

## Step 6: Run Codegen

```bash
pnpm run gql:generate
```

This generates TypeScript types for your new `.graphql` operation.

## Step 7: Write Tests

Add tests in `test/unit/` and `test/integration/`:

```ts
// test/unit/core/registry/cards/issue.pin.test.ts
it("issue.pin card loads and validates", () => {
  const card = getOperationCard("issue.pin")
  expect(card).toBeDefined()
  expect(card!.capability_id).toBe("issue.pin")
})
```

## Step 8: Verify

```bash
pnpm run typecheck    # TypeScript compiles
pnpm run test         # Unit tests pass
pnpm run gql:verify   # Generated code is in sync
pnpm run lint         # Linting passes
```

## Next Steps

- [Operation Cards](../concepts/operation-cards.md) — card fields reference
- [Architecture: Adapters](../architecture/adapters.md) — adapter internals
- [Contributing](../contributing/README.md) — dev setup and code style

# Issue Domain Eval Workflows Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3 multi-step eval scenarios covering the issue domain (triage, close, cross-domain issue-to-PR lifecycle) with new fixture seeders and verification.

**Architecture:** New seeders extend the existing `FixtureSeeder` interface and register in the seeder index. Scenarios are JSON files validated by `EvalScenarioSchema`. The `FixtureManager.seedOne()` always applies the `@ghx-dev/eval` tracking label (needed for cleanup), so checkpoint assertions account for it. The issue-branch composite seeder creates both an issue and a Git branch via the GitHub API.

**Tech Stack:** TypeScript (ESM/NodeNext), Vitest, `gh` CLI, GitHub REST/GraphQL API

**Spec:** `docs/superpowers/specs/2026-03-14-issue-eval-workflows-design.md`

---

## Important: Tracking Label Constraint

`FixtureManager.seedOne()` (manager.ts:143-146) always passes `labels: ["@ghx-dev/eval"]` to seeders. The existing `createIssueSeeder()` spreads these into `--label` args. Cleanup (`closeResource`, `listLabeledResources`) relies on this label.

**Consequence for checkpoints:**
- Triage scenario: fixture starts with 1 label (`@ghx-dev/eval`), checkpoint asserts `labels.length >= 2` (tracking + agent-applied)
- Bug-close scenario: fixture starts with 2 labels (`@ghx-dev/eval`, `bug`), after swap expect `["@ghx-dev/eval", "resolved"]` → `labels.length == 2`

This differs from the spec's "no tracking label" approach. The spec is updated here because removing the tracking label would break the cleanup mechanism.

## Binding Resolution Note

The `bindFixtureVariables()` function (fixture-binder.ts:81-89) automatically derives `{{owner}}` and `{{repo_name}}` from any `repo` binding. So scenarios only need to explicitly bind `repo` — `owner` and `repo_name` are available in prompts and checkpoint inputs without explicit bindings.

For `{{assignee}}` and `{{milestone_number}}` in the triage scenario: these are passed as `extraVariables` to `bindFixtureVariables()` from the eval config. The eval config must define these values. For v1, drop the milestone checkpoint since `issue.view` doesn't include a `milestone` field in its output schema.

## Parallelization Note

Tasks 1-3 (seeders) are independent and can be executed in parallel by subagents.

---

## Chunk 1: Triage Issue Seeder + Scenario

### Task 1: Create the triage issue seeder

**Files:**
- Create: `packages/eval/src/fixture/seeders/triage-issue-seeder.ts`
- Test: `packages/eval/test/unit/fixture/seeders/triage-issue-seeder.test.ts`

The triage seeder creates an issue with a rich bug-report body (reproduction steps, expected/actual behavior) so the agent has content to triage. It extends the same pattern as `createIssueSeeder()` but with a detailed body.

- [ ] **Step 1: Write the failing test**

Create `packages/eval/test/unit/fixture/seeders/triage-issue-seeder.test.ts`:

```typescript
import * as childProcess from "node:child_process"
import { createTriageIssueSeeder } from "@eval/fixture/seeders/triage-issue-seeder.js"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}))

const mockedExecFile = vi.mocked(childProcess.execFile)

function mockExecFileResults(
  results: readonly { readonly stdout: string; readonly stderr: string }[],
) {
  let callIndex = 0
  mockedExecFile.mockImplementation((...args: unknown[]) => {
    const callback = args[args.length - 1] as (
      err: Error | null,
      stdout: string,
      stderr: string,
    ) => void
    const result = results[callIndex++]
    if (!result) {
      callback(new Error("unexpected execFile call"), "", "")
    } else {
      callback(null, result.stdout, result.stderr)
    }
    return {} as ReturnType<typeof childProcess.execFile>
  })
}

describe("createTriageIssueSeeder", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a seeder with type 'issue'", () => {
    const seeder = createTriageIssueSeeder()
    expect(seeder.type).toBe("issue")
  })

  it("creates an issue with a detailed triage body", async () => {
    const issueList = [{ number: 10, title: "[@ghx-dev/eval] issue_for_triage" }]

    mockExecFileResults([
      { stdout: "", stderr: "" },
      { stdout: JSON.stringify(issueList), stderr: "" },
    ])

    const seeder = createTriageIssueSeeder()
    const result = await seeder.seed({
      repo: "acme/sandbox",
      name: "issue_for_triage",
      labels: ["@ghx-dev/eval"],
    })

    expect(result).toEqual({
      type: "issue",
      number: 10,
      repo: "acme/sandbox",
      labels: ["@ghx-dev/eval"],
      metadata: {},
    })

    // Verify the body contains triage-relevant content
    const createCall = mockedExecFile.mock.calls[0] as unknown[]
    const args = createCall[1] as string[]
    const bodyIndex = args.indexOf("--body")
    const body = args[bodyIndex + 1]
    expect(body).toContain("Steps to reproduce")
    expect(body).toContain("Expected behavior")
    expect(body).toContain("Actual behavior")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/seeders/triage-issue-seeder.test.ts`
Expected: FAIL — module `@eval/fixture/seeders/triage-issue-seeder.js` not found

- [ ] **Step 3: Write the seeder implementation**

Create `packages/eval/src/fixture/seeders/triage-issue-seeder.ts`:

```typescript
import type { FixtureResource } from "@eval/fixture/manifest.js"
import { runGh } from "@eval/fixture/seeders/gh.js"
import type { FixtureSeeder, SeedOptions } from "@eval/fixture/seeders/types.js"

const TRIAGE_BODY = `## Bug Report

**Environment:** Production (us-east-1)

### Steps to reproduce
1. Send 500+ concurrent requests to the /api/v2/users endpoint
2. Monitor response times over a 5-minute window
3. Observe increasing latency after ~200 requests

### Expected behavior
Response times should remain stable under 200ms p95 regardless of concurrency.

### Actual behavior
Response times degrade to 2-3 seconds after sustained load. Memory usage climbs
steadily, suggesting a connection pool leak. The issue started after the v2.4.1
deployment on Monday.

### Impact
Affecting ~15% of API consumers during peak hours. No data loss observed.`

export function createTriageIssueSeeder(): FixtureSeeder {
  return {
    type: "issue",

    async seed(options: SeedOptions): Promise<FixtureResource> {
      const title = `[@ghx-dev/eval] ${options.name}`

      const createArgs = [
        "issue",
        "create",
        "--repo",
        options.repo,
        "--title",
        title,
        "--body",
        TRIAGE_BODY,
        ...options.labels.flatMap((label) => ["--label", label]),
      ]
      await runGh(createArgs)

      const listArgs = [
        "issue",
        "list",
        "--repo",
        options.repo,
        "--label",
        "@ghx-dev/eval",
        "--json",
        "number,title",
        "--limit",
        "1",
        "--search",
        title,
      ]
      const listOutput = await runGh(listArgs)
      const issues: readonly { readonly number: number; readonly title: string }[] =
        JSON.parse(listOutput)

      const match = issues.find((i) => i.title === title)
      if (!match) {
        throw new Error(`Could not find issue "${options.name}" after creation in ${options.repo}`)
      }

      return {
        type: "issue",
        number: match.number,
        repo: options.repo,
        labels: [...options.labels],
        metadata: {},
      }
    },
  }
}
```

**Note:** This seeder returns `type: "issue"`, same as the existing issue seeder. That is intentional — the seeder registry resolves by fixture name prefix, and `issue_for_triage` maps to `"issue"`. But we register this seeder under the full fixture name `"issue_for_triage"` (Task 4) so the manager uses it instead of the generic one.

Wait — actually, looking at `seedOne` line 139: `const type = hasSeeder(fixtureName) ? fixtureName : (fixtureName.split("_")[0] ?? "pr")`. For `issue_for_triage`, it first checks if a seeder named `"issue_for_triage"` exists. If not, falls back to `"issue"` prefix. Since the generic `createIssueSeeder()` is already registered as `"issue"`, and its body is just a plain "Auto-created fixture" string, we need this specialized seeder.

**Revised approach:** Register this seeder under type `"issue_for_triage"` so `seedOne` picks it up by full name match.

Update the seeder's type:

```typescript
export function createTriageIssueSeeder(): FixtureSeeder {
  return {
    type: "issue_for_triage",
    // ... rest same
  }
}
```

And update the test accordingly:

```typescript
it("returns a seeder with type 'issue_for_triage'", () => {
  const seeder = createTriageIssueSeeder()
  expect(seeder.type).toBe("issue_for_triage")
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/seeders/triage-issue-seeder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/eval/src/fixture/seeders/triage-issue-seeder.ts packages/eval/test/unit/fixture/seeders/triage-issue-seeder.test.ts
git commit -m "feat(eval): add triage issue seeder with detailed bug report body"
```

---

### Task 2: Create the bug issue seeder

**Files:**
- Create: `packages/eval/src/fixture/seeders/bug-issue-seeder.ts`
- Test: `packages/eval/test/unit/fixture/seeders/bug-issue-seeder.test.ts`

The bug seeder creates an issue with the `bug` label (in addition to the tracking label applied by the manager) and stores the search term in metadata.

- [ ] **Step 1: Write the failing test**

Create `packages/eval/test/unit/fixture/seeders/bug-issue-seeder.test.ts`:

```typescript
import * as childProcess from "node:child_process"
import { createBugIssueSeeder } from "@eval/fixture/seeders/bug-issue-seeder.js"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}))

const mockedExecFile = vi.mocked(childProcess.execFile)

function mockExecFileResults(
  results: readonly { readonly stdout: string; readonly stderr: string }[],
) {
  let callIndex = 0
  mockedExecFile.mockImplementation((...args: unknown[]) => {
    const callback = args[args.length - 1] as (
      err: Error | null,
      stdout: string,
      stderr: string,
    ) => void
    const result = results[callIndex++]
    if (!result) {
      callback(new Error("unexpected execFile call"), "", "")
    } else {
      callback(null, result.stdout, result.stderr)
    }
    return {} as ReturnType<typeof childProcess.execFile>
  })
}

describe("createBugIssueSeeder", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a seeder with type 'issue_bug_to_close'", () => {
    const seeder = createBugIssueSeeder()
    expect(seeder.type).toBe("issue_bug_to_close")
  })

  it("creates an issue with bug label and stores searchTerm in metadata", async () => {
    const issueList = [{ number: 20, title: "[@ghx-dev/eval] issue_bug_to_close" }]

    mockExecFileResults([
      { stdout: "", stderr: "" },
      { stdout: JSON.stringify(issueList), stderr: "" },
    ])

    const seeder = createBugIssueSeeder()
    const result = await seeder.seed({
      repo: "acme/sandbox",
      name: "issue_bug_to_close",
      labels: ["@ghx-dev/eval"],
    })

    expect(result).toEqual({
      type: "issue",
      number: 20,
      repo: "acme/sandbox",
      labels: ["@ghx-dev/eval", "bug"],
      metadata: { searchTerm: "Memory leak in connection pooling" },
    })
  })

  it("includes the bug label in gh issue create args", async () => {
    const issueList = [{ number: 5, title: "[@ghx-dev/eval] issue_bug_to_close" }]

    mockExecFileResults([
      { stdout: "", stderr: "" },
      { stdout: JSON.stringify(issueList), stderr: "" },
    ])

    const seeder = createBugIssueSeeder()
    await seeder.seed({
      repo: "acme/sandbox",
      name: "issue_bug_to_close",
      labels: ["@ghx-dev/eval"],
    })

    const createCall = mockedExecFile.mock.calls[0] as unknown[]
    const args = createCall[1] as string[]
    // Should have both @ghx-dev/eval and bug labels
    const labelIndices = args.reduce<number[]>((acc, arg, i) => {
      if (arg === "--label") acc.push(i)
      return acc
    }, [])
    const labels = labelIndices.map((i) => args[i + 1])
    expect(labels).toContain("@ghx-dev/eval")
    expect(labels).toContain("bug")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/seeders/bug-issue-seeder.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the seeder implementation**

Create `packages/eval/src/fixture/seeders/bug-issue-seeder.ts`:

```typescript
import type { FixtureResource } from "@eval/fixture/manifest.js"
import { runGh } from "@eval/fixture/seeders/gh.js"
import type { FixtureSeeder, SeedOptions } from "@eval/fixture/seeders/types.js"

const SEARCH_TERM = "Memory leak in connection pooling"

const BUG_BODY = `## Bug Report

Users are reporting intermittent connection timeouts when the application is under
sustained load. Investigation points to a connection pool leak in the database
adapter — connections are acquired but not released when queries timeout.

### Reproduction
1. Run the load test suite with 100 concurrent connections
2. After ~3 minutes, observe connection pool exhaustion errors
3. Database shows active connections climbing without release

### Logs
\`\`\`
WARN  pool: no available connections (active=100, idle=0, waiting=47)
ERROR query timeout after 30000ms — connection not returned to pool
\`\`\`
`

export function createBugIssueSeeder(): FixtureSeeder {
  return {
    type: "issue_bug_to_close",

    async seed(options: SeedOptions): Promise<FixtureResource> {
      const title = `[@ghx-dev/eval] ${SEARCH_TERM}`
      const allLabels = [...options.labels, "bug"]

      const createArgs = [
        "issue",
        "create",
        "--repo",
        options.repo,
        "--title",
        title,
        "--body",
        BUG_BODY,
        ...allLabels.flatMap((label) => ["--label", label]),
      ]
      await runGh(createArgs)

      const listArgs = [
        "issue",
        "list",
        "--repo",
        options.repo,
        "--label",
        "@ghx-dev/eval",
        "--json",
        "number,title",
        "--limit",
        "1",
        "--search",
        title,
      ]
      const listOutput = await runGh(listArgs)
      const issues: readonly { readonly number: number; readonly title: string }[] =
        JSON.parse(listOutput)

      const match = issues.find((i) => i.title === title)
      if (!match) {
        throw new Error(
          `Could not find bug issue after creation in ${options.repo}`,
        )
      }

      return {
        type: "issue",
        number: match.number,
        repo: options.repo,
        labels: allLabels,
        metadata: { searchTerm: SEARCH_TERM },
      }
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/seeders/bug-issue-seeder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/eval/src/fixture/seeders/bug-issue-seeder.ts packages/eval/test/unit/fixture/seeders/bug-issue-seeder.test.ts
git commit -m "feat(eval): add bug issue seeder with search term metadata"
```

---

### Task 3: Create the issue-branch composite seeder

**Files:**
- Create: `packages/eval/src/fixture/seeders/issue-branch-seeder.ts`
- Test: `packages/eval/test/unit/fixture/seeders/issue-branch-seeder.test.ts`

This seeder creates an issue AND pushes a feature branch to the fixture repo via the GitHub API (no local git clone needed). Uses the same REST API approach as `pr-seeder.ts` for branch creation.

- [ ] **Step 1: Write the failing test**

Create `packages/eval/test/unit/fixture/seeders/issue-branch-seeder.test.ts`:

```typescript
import * as childProcess from "node:child_process"
import { createIssueBranchSeeder } from "@eval/fixture/seeders/issue-branch-seeder.js"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
}))

const mockedExecFile = vi.mocked(childProcess.execFile)

function mockExecFileResults(
  results: readonly { readonly stdout: string; readonly stderr: string }[],
) {
  let callIndex = 0
  mockedExecFile.mockImplementation((...args: unknown[]) => {
    const callback = args[args.length - 1] as (
      err: Error | null,
      stdout: string,
      stderr: string,
    ) => void
    const result = results[callIndex++]
    if (!result) {
      callback(new Error("unexpected execFile call"), "", "")
    } else {
      callback(null, result.stdout, result.stderr)
    }
    return {} as ReturnType<typeof childProcess.execFile>
  })
}

describe("createIssueBranchSeeder", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns a seeder with type 'issue_with_branch'", () => {
    const seeder = createIssueBranchSeeder()
    expect(seeder.type).toBe("issue_with_branch")
  })

  it("creates an issue and a branch, returning composite metadata", async () => {
    const branchName = "eval-fix-issue_with_branch"
    const issueList = [{ number: 30, title: "[@ghx-dev/eval] issue_with_branch" }]

    mockExecFileResults([
      // 1. gh api - get default branch
      { stdout: JSON.stringify({ default_branch: "main" }), stderr: "" },
      // 2. gh api - get HEAD sha
      { stdout: JSON.stringify({ object: { sha: "abc123" } }), stderr: "" },
      // 3. gh api - create tree
      { stdout: JSON.stringify({ sha: "tree456" }), stderr: "" },
      // 4. gh api - create commit
      { stdout: JSON.stringify({ sha: "commit789" }), stderr: "" },
      // 5. gh api - create ref
      { stdout: JSON.stringify({ ref: `refs/heads/${branchName}` }), stderr: "" },
      // 6. gh issue create
      { stdout: "", stderr: "" },
      // 7. gh issue list
      { stdout: JSON.stringify(issueList), stderr: "" },
    ])

    const seeder = createIssueBranchSeeder()
    const result = await seeder.seed({
      repo: "acme/sandbox",
      name: "issue_with_branch",
      labels: ["@ghx-dev/eval"],
    })

    expect(result).toEqual({
      type: "issue",
      number: 30,
      repo: "acme/sandbox",
      labels: ["@ghx-dev/eval"],
      metadata: {
        headBranch: branchName,
        baseBranch: "main",
        branchSha: "commit789",
      },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/seeders/issue-branch-seeder.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the seeder implementation**

Create `packages/eval/src/fixture/seeders/issue-branch-seeder.ts`:

```typescript
import type { FixtureResource } from "@eval/fixture/manifest.js"
import { runGh, runGhWithInput } from "@eval/fixture/seeders/gh.js"
import type { FixtureSeeder, SeedOptions } from "@eval/fixture/seeders/types.js"

const FIXTURE_FILE_CONTENT = `# Eval Fixture Change

This file was added by the eval fixture seeder to create a diff for PR creation.

## Changes
- Added configuration for connection pool monitoring
- Set max idle timeout to 30 seconds
- Enable pool health check on borrow
`

export function createIssueBranchSeeder(): FixtureSeeder {
  return {
    type: "issue_with_branch",

    async seed(options: SeedOptions): Promise<FixtureResource> {
      const branchName = `eval-fix-${options.name}-${Date.now()}`

      // 1. Get default branch and HEAD SHA
      const defaultBranchRaw = await runGh([
        "api", `repos/${options.repo}`, "--jq", ".default_branch",
      ])
      const defaultBranch = defaultBranchRaw || "main"

      const headSha = await runGh([
        "api", `repos/${options.repo}/git/ref/heads/${defaultBranch}`, "--jq", ".object.sha",
      ])

      // 2. Create a tree with a fixture file (uses runGhWithInput for JSON body via stdin)
      const treeBody = JSON.stringify({
        base_tree: headSha,
        tree: [
          {
            path: "eval-fixture-change.md",
            mode: "100644",
            type: "blob",
            content: FIXTURE_FILE_CONTENT,
          },
        ],
      })
      const treeRaw = await runGhWithInput(
        ["api", `repos/${options.repo}/git/trees`, "--method", "POST", "--input", "-"],
        treeBody,
      )
      const treeSha = (JSON.parse(treeRaw) as { sha: string }).sha

      // 3. Create a commit
      const commitBody = JSON.stringify({
        message: "feat: add connection pool monitoring config",
        tree: treeSha,
        parents: [headSha],
      })
      const commitRaw = await runGhWithInput(
        ["api", `repos/${options.repo}/git/commits`, "--method", "POST", "--input", "-"],
        commitBody,
      )
      const commitSha = (JSON.parse(commitRaw) as { sha: string }).sha

      // 4. Create the branch ref
      const refBody = JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: commitSha,
      })
      await runGhWithInput(
        ["api", `repos/${options.repo}/git/refs`, "--method", "POST", "--input", "-"],
        refBody,
      )

      // 5. Create the issue
      const title = `[@ghx-dev/eval] ${options.name}`
      const issueBody = `Implement connection pool monitoring.\n\nThis issue tracks adding health checks and idle timeout configuration to prevent pool exhaustion under load.`
      await runGh([
        "issue",
        "create",
        "--repo",
        options.repo,
        "--title",
        title,
        "--body",
        issueBody,
        ...options.labels.flatMap((label) => ["--label", label]),
      ])

      // 6. Find the created issue
      const listOutput = await runGh([
        "issue",
        "list",
        "--repo",
        options.repo,
        "--label",
        "@ghx-dev/eval",
        "--json",
        "number,title",
        "--limit",
        "1",
        "--search",
        title,
      ])
      const issues: readonly { readonly number: number; readonly title: string }[] =
        JSON.parse(listOutput)

      const match = issues.find((i) => i.title === title)
      if (!match) {
        throw new Error(
          `Could not find issue "${options.name}" after creation in ${options.repo}`,
        )
      }

      return {
        type: "issue",
        number: match.number,
        repo: options.repo,
        labels: [...options.labels],
        metadata: {
          headBranch: branchName,
          baseBranch: defaultBranch,
          branchSha: commitSha,
        },
      }
    },
  }
}
```

**Implementation note:** This follows the `pr-seeder.ts` pattern for Git operations via the GitHub API (`/git/trees`, `/git/commits`, `/git/refs`). Uses `runGhWithInput` from `gh.ts` to pipe JSON bodies via stdin, matching the pattern in `pr-seeder.ts`. Branch name includes `Date.now()` for uniqueness in case cleanup fails. The test mocks `execFile` and `spawn` calls directly — verify the actual `gh api` invocations work during fixture verification (Task 7).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/seeders/issue-branch-seeder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/eval/src/fixture/seeders/issue-branch-seeder.ts packages/eval/test/unit/fixture/seeders/issue-branch-seeder.test.ts
git commit -m "feat(eval): add composite issue-branch seeder for cross-domain scenarios"
```

---

### Task 4: Register new seeders in the index

**Files:**
- Modify: `packages/eval/src/fixture/seeders/index.ts`
- Modify: `packages/eval/test/unit/fixture/seeders/registry.test.ts`

- [ ] **Step 1: Update the registry test**

Add tests for the 3 new seeder registrations in `packages/eval/test/unit/fixture/seeders/registry.test.ts`. Check that `hasSeeder("issue_for_triage")`, `hasSeeder("issue_bug_to_close")`, and `hasSeeder("issue_with_branch")` all return `true`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/seeders/registry.test.ts`
Expected: FAIL — new seeder types not registered

- [ ] **Step 3: Update the seeder index**

Add to `packages/eval/src/fixture/seeders/index.ts`:

```typescript
import { createBugIssueSeeder } from "./bug-issue-seeder.js"
import { createIssueBranchSeeder } from "./issue-branch-seeder.js"
import { createTriageIssueSeeder } from "./triage-issue-seeder.js"

// ... existing registrations ...

registerSeeder(createTriageIssueSeeder())
registerSeeder(createBugIssueSeeder())
registerSeeder(createIssueBranchSeeder())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/seeders/registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/eval/src/fixture/seeders/index.ts packages/eval/test/unit/fixture/seeders/registry.test.ts
git commit -m "feat(eval): register triage, bug, and issue-branch seeders"
```

---

## Chunk 2: Scenario JSON Files + Scenario Sets

### Task 5: Create the 3 scenario JSON files

**Files:**
- Create: `packages/eval/scenarios/issue-triage-and-assign-wf-001.json`
- Create: `packages/eval/scenarios/issue-close-with-context-wf-001.json`
- Create: `packages/eval/scenarios/issue-to-pr-lifecycle-wf-001.json`

- [ ] **Step 1: Create `issue-triage-and-assign-wf-001.json`**

```json
{
  "id": "issue-triage-and-assign-wf-001",
  "name": "Triage and Assign Issue",
  "description": "Agent triages a newly filed issue by reading it, inspecting available labels, applying labels, assigning a user, setting a milestone, and posting a triage summary comment.",
  "category": "issue",
  "difficulty": "intermediate",
  "prompt": "Issue #{{issue_number}} in {{repo}} has just been filed. Triage it: read the issue, check the repo's available labels, apply the most relevant labels, assign it to user '{{assignee}}', set milestone #{{milestone_number}}, and post a triage summary comment explaining the priority and next steps.",
  "timeoutMs": 120000,
  "allowedRetries": 1,
  "tags": ["issue", "triage", "labels", "assign", "milestone", "api-only"],
  "fixture": {
    "repo": "{{fixture_repo}}",
    "requires": ["issue_for_triage"],
    "bindings": {
      "issue_number": "issue_for_triage.number",
      "repo": "issue_for_triage.repo"
    },
    "reseedPerIteration": false,
    "seedPerIteration": true
  },
  "assertions": {
    "checkpoints": [
      {
        "id": "labels-applied",
        "description": "At least one domain label applied (fixture starts with only @ghx-dev/eval tracking label)",
        "task": "issue.view",
        "input": {
          "owner": "{{owner}}",
          "name": "{{repo_name}}",
          "issueNumber": "{{issue_number}}"
        },
        "condition": { "type": "field_gte", "path": "labels.length", "value": 2 }
      },
      {
        "id": "triage-comment-exists",
        "description": "A triage summary comment was posted on the issue",
        "task": "issue.comments.list",
        "input": {
          "owner": "{{owner}}",
          "name": "{{repo_name}}",
          "issueNumber": "{{issue_number}}",
          "first": 10
        },
        "condition": { "type": "field_gte", "path": "items.length", "value": 1 }
      }
    ],
    "expectedCapabilities": [
      "issue.view",
      "repo.labels.list",
      "issue.labels.set",
      "issue.assignees.add",
      "issue.milestone.set",
      "issue.comments.create"
    ]
  }
}
```

**Note on milestone:** The `issue.view` output schema does not include a `milestone` field, so milestone verification is not possible with current cards. The milestone checkpoint is deferred. The prompt still instructs the agent to set a milestone (and `issue.milestone.set` is in `expectedCapabilities` for behavioral analysis), but we cannot assert it was set. To add milestone verification later, extend the `issue.view` card and its GraphQL query to include `milestone { number title }`.

The `{{assignee}}` and `{{milestone_number}}` template variables must be provided as `extraVariables` in the eval config (not fixture bindings). For v1, these can be hardcoded in eval config.

- [ ] **Step 2: Create `issue-close-with-context-wf-001.json`**

```json
{
  "id": "issue-close-with-context-wf-001",
  "name": "Close Issue with Context",
  "description": "Agent searches for a specific bug issue, posts a resolution comment, updates labels from bug to resolved, and closes the issue.",
  "category": "issue",
  "difficulty": "intermediate",
  "prompt": "In {{repo}}, find open issues with the label 'bug'. View each one and find the issue whose title contains '{{search_term}}'. Post a resolution comment explaining the fix, replace the 'bug' label with 'resolved', and close the issue.",
  "timeoutMs": 120000,
  "allowedRetries": 1,
  "tags": ["issue", "close", "labels", "search", "api-only"],
  "fixture": {
    "repo": "{{fixture_repo}}",
    "requires": ["issue_bug_to_close"],
    "bindings": {
      "issue_number": "issue_bug_to_close.number",
      "repo": "issue_bug_to_close.repo",
      "search_term": "issue_bug_to_close.metadata.searchTerm"
    },
    "reseedPerIteration": false,
    "seedPerIteration": true
  },
  "assertions": {
    "checkpoints": [
      {
        "id": "issue-closed",
        "description": "Issue state is CLOSED",
        "task": "issue.view",
        "input": {
          "owner": "{{owner}}",
          "name": "{{repo_name}}",
          "issueNumber": "{{issue_number}}"
        },
        "condition": { "type": "field_equals", "path": "state", "value": "CLOSED" }
      },
      {
        "id": "resolution-comment",
        "description": "A resolution comment was posted",
        "task": "issue.comments.list",
        "input": {
          "owner": "{{owner}}",
          "name": "{{repo_name}}",
          "issueNumber": "{{issue_number}}",
          "first": 10
        },
        "condition": { "type": "field_gte", "path": "items.length", "value": 1 }
      },
      {
        "id": "label-count-correct",
        "description": "Exactly 2 labels remain (tracking label + resolved, bug removed)",
        "task": "issue.view",
        "input": {
          "owner": "{{owner}}",
          "name": "{{repo_name}}",
          "issueNumber": "{{issue_number}}"
        },
        "condition": { "type": "field_equals", "path": "labels.length", "value": 2 }
      },
      {
        "id": "resolved-label-applied",
        "description": "The resolved label is present (alphabetically after @ghx-dev/eval)",
        "task": "issue.view",
        "input": {
          "owner": "{{owner}}",
          "name": "{{repo_name}}",
          "issueNumber": "{{issue_number}}"
        },
        "condition": { "type": "field_equals", "path": "labels.1", "value": "resolved" }
      }
    ],
    "expectedCapabilities": [
      "issue.list",
      "issue.view",
      "issue.comments.create",
      "issue.labels.set",
      "issue.close"
    ]
  }
}
```

**Note on label checkpoint:** The `resolved-label-applied` checkpoint assumes GitHub returns labels sorted alphabetically (`@ghx-dev/eval` < `resolved`). If label ordering proves unreliable, a `field_array_contains` condition type should be added to the scorer.

- [ ] **Step 3: Create `issue-to-pr-lifecycle-wf-001.json`**

```json
{
  "id": "issue-to-pr-lifecycle-wf-001",
  "name": "Issue to PR Lifecycle",
  "description": "Agent reads an issue, creates a PR referencing it from a pre-existing branch, and submits a review requesting changes. Tests cross-domain issue+PR coordination.",
  "category": "issue",
  "difficulty": "advanced",
  "prompt": "Issue #{{issue_number}} in {{repo}} describes a needed change. Create a PR from branch '{{head_branch}}' to '{{base_branch}}' that references this issue (include 'Fixes #{{issue_number}}' in the body). Then submit a review on the PR requesting changes with at least one specific suggestion.",
  "timeoutMs": 180000,
  "allowedRetries": 1,
  "tags": ["issue", "pr", "cross-domain", "lifecycle", "api-only"],
  "fixture": {
    "repo": "{{fixture_repo}}",
    "requires": ["issue_with_branch"],
    "bindings": {
      "issue_number": "issue_with_branch.number",
      "repo": "issue_with_branch.repo",
      "head_branch": "issue_with_branch.metadata.headBranch",
      "base_branch": "issue_with_branch.metadata.baseBranch"
    },
    "reseedPerIteration": false,
    "seedPerIteration": true
  },
  "assertions": {
    "checkpoints": [
      {
        "id": "pr-created-for-issue",
        "description": "At least one PR is linked to the issue",
        "task": "issue.relations.prs.list",
        "input": {
          "owner": "{{owner}}",
          "name": "{{repo_name}}",
          "issueNumber": "{{issue_number}}"
        },
        "condition": { "type": "field_gte", "path": "items.length", "value": 1 }
      }
    ],
    "expectedCapabilities": [
      "issue.view",
      "pr.create",
      "pr.reviews.submit"
    ]
  }
}
```

- [ ] **Step 4: Validate all 3 scenarios**

Run: `pnpm --filter @ghx-dev/eval run eval check --scenarios`
Expected: All scenarios pass validation (schema, ID format, checkpoint tasks exist)

- [ ] **Step 5: Commit**

```bash
git add packages/eval/scenarios/issue-triage-and-assign-wf-001.json packages/eval/scenarios/issue-close-with-context-wf-001.json packages/eval/scenarios/issue-to-pr-lifecycle-wf-001.json
git commit -m "feat(eval): add 3 issue-domain eval scenario definitions"
```

---

### Task 6: Update scenario sets

**Files:**
- Modify: `packages/eval/scenarios/scenario-sets.json`

- [ ] **Step 1: Update scenario-sets.json**

Replace contents of `packages/eval/scenarios/scenario-sets.json`:

```json
{
  "default": ["pr-reply-threads-wf-001"],
  "pr-only": ["pr-reply-threads-wf-001", "pr-review-comment-001"],
  "issue-only": [
    "issue-triage-and-assign-wf-001",
    "issue-close-with-context-wf-001",
    "issue-to-pr-lifecycle-wf-001"
  ],
  "full": [
    "pr-reply-threads-wf-001",
    "pr-review-comment-001",
    "issue-triage-and-assign-wf-001",
    "issue-close-with-context-wf-001",
    "issue-to-pr-lifecycle-wf-001"
  ]
}
```

- [ ] **Step 2: Run format to ensure JSON formatting is correct**

Run: `pnpm run format`

- [ ] **Step 3: Commit**

```bash
git add packages/eval/scenarios/scenario-sets.json
git commit -m "feat(eval): add issue-only scenario set and update full set"
```

---

## Chunk 3: Fixture Verification + Cleanup

### Task 7: Verify fixtures work end-to-end

This task runs against the live fixture repo. It seeds each new fixture type, verifies the expected GitHub state, and cleans up.

**Prerequisites:**
- `GITHUB_TOKEN` set with repo access to the fixture repo
- The fixture repo (`aryeko/ghx-bench-fixtures`) must have:
  - At least one open milestone
  - `bug` label (GitHub default, likely exists)
  - `resolved` label (create manually if missing: `gh label create resolved --repo aryeko/ghx-bench-fixtures --color 0E8A16`)

- [ ] **Step 1: Verify fixture repo prerequisites**

```bash
# Check milestone exists
gh api repos/aryeko/ghx-bench-fixtures/milestones --jq '.[0].number'

# Check labels exist
gh label list --repo aryeko/ghx-bench-fixtures --search bug --json name --jq '.[].name'
gh label list --repo aryeko/ghx-bench-fixtures --search resolved --json name --jq '.[].name'

# Create resolved label if missing
gh label create resolved --repo aryeko/ghx-bench-fixtures --color 0E8A16 --force
```

- [ ] **Step 2: Build the eval package**

```bash
pnpm run build
```

- [ ] **Step 3: Seed and verify triage issue fixture**

```bash
# Seed
pnpm --filter @ghx-dev/eval run eval fixture seed --repo aryeko/ghx-bench-fixtures --seed-id verify-triage

# Verify the manifest was written
cat packages/eval/fixtures/latest.json | jq '.fixtures.issue_for_triage'
# Expected: { type: "issue", number: <N>, repo: "aryeko/ghx-bench-fixtures", labels: ["@ghx-dev/eval"], metadata: {} }

# Verify the issue exists on GitHub and has expected state
ISSUE_NUM=$(cat packages/eval/fixtures/latest.json | jq '.fixtures.issue_for_triage.number')
gh issue view $ISSUE_NUM --repo aryeko/ghx-bench-fixtures --json title,state,labels,body
# Expected: state=OPEN, labels=["@ghx-dev/eval"], body contains "Steps to reproduce"
```

- [ ] **Step 4: Seed and verify bug issue fixture**

```bash
# Seed (if not already in manifest from step 3)
ISSUE_NUM=$(cat packages/eval/fixtures/latest.json | jq '.fixtures.issue_bug_to_close.number')
gh issue view $ISSUE_NUM --repo aryeko/ghx-bench-fixtures --json title,state,labels,body
# Expected: state=OPEN, labels=["@ghx-dev/eval", "bug"], title contains "Memory leak"
```

- [ ] **Step 5: Seed and verify issue-branch fixture**

```bash
ISSUE_NUM=$(cat packages/eval/fixtures/latest.json | jq '.fixtures.issue_with_branch.number')
BRANCH=$(cat packages/eval/fixtures/latest.json | jq -r '.fixtures.issue_with_branch.metadata.headBranch')

# Verify issue exists
gh issue view $ISSUE_NUM --repo aryeko/ghx-bench-fixtures --json title,state
# Expected: state=OPEN

# Verify branch exists
gh api repos/aryeko/ghx-bench-fixtures/branches/$BRANCH --jq '.name'
# Expected: eval-fix-issue_with_branch
```

- [ ] **Step 6: Clean up all fixtures**

```bash
pnpm --filter @ghx-dev/eval run eval fixture cleanup --repo aryeko/ghx-bench-fixtures --all

# Verify cleanup
gh issue list --repo aryeko/ghx-bench-fixtures --label @ghx-dev/eval --json number
# Expected: []

# Delete the branch manually (cleanup only closes issues/PRs, not branches)
gh api repos/aryeko/ghx-bench-fixtures/git/refs/heads/$BRANCH --method DELETE
```

- [ ] **Step 7: Commit any manifest/config changes if needed**

If the fixture verification revealed issues that required seeder code changes, commit those fixes.

---

### Task 8: Add branch cleanup to eval hooks

**Files:**
- Modify: `packages/eval/src/hooks/eval-hooks.ts`
- Modify: `packages/eval/test/unit/hooks/eval-hooks.test.ts`

The `afterScenario` hook currently only calls `closeResource` (closes PRs/issues). For the issue-branch seeder, it also needs to delete the pushed branch.

- [ ] **Step 1: Update the eval hooks test**

Add a test case in `packages/eval/test/unit/hooks/eval-hooks.test.ts` that verifies: when `afterScenario` cleans up a resource with `metadata.headBranch`, it also calls `deleteBranch` on the fixture manager.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/hooks/eval-hooks.test.ts -t "branch"`
Expected: FAIL

- [ ] **Step 3: Add `deleteBranch` method to FixtureManager**

Add to `packages/eval/src/fixture/manager.ts`:

```typescript
async deleteBranch(repo: string, branch: string): Promise<void> {
  try {
    await this.runGh([
      "api",
      `repos/${repo}/git/refs/heads/${branch}`,
      "--method",
      "DELETE",
    ])
  } catch {
    // best-effort: branch may already be deleted
  }
}
```

- [ ] **Step 4: Update `afterScenario` in eval-hooks.ts**

In the cleanup loop in `afterScenario`, after `closeResource`, check for branch metadata:

```typescript
for (const resource of resources) {
  try {
    await options.fixtureManager.closeResource(resource)
    // Clean up branches for composite seeders (e.g. issue_with_branch)
    const branch = resource.metadata?.headBranch
    if (typeof branch === "string") {
      await options.fixtureManager.deleteBranch(resource.repo, branch)
    }
  } catch {
    // best-effort
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/hooks/eval-hooks.test.ts`
Expected: PASS

- [ ] **Step 6: Run full eval test suite**

Run: `pnpm --filter @ghx-dev/eval run test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add packages/eval/src/fixture/manager.ts packages/eval/src/hooks/eval-hooks.ts packages/eval/test/unit/hooks/eval-hooks.test.ts
git commit -m "feat(eval): add branch cleanup to afterScenario hook for composite seeders"
```

---

### Task 9: Run CI and final verification

- [ ] **Step 1: Run full CI suite**

```bash
pnpm run ci --outputStyle=static
```

Expected: All checks pass (build, format, lint, typecheck, tests)

- [ ] **Step 2: Verify scenario validation**

```bash
pnpm --filter @ghx-dev/eval run eval check --scenarios
```

Expected: All 5 scenarios (2 existing + 3 new) pass validation

- [ ] **Step 3: Commit any remaining fixes**

If CI revealed issues, fix and commit.

---

## Summary of Files

### Created
- `packages/eval/src/fixture/seeders/triage-issue-seeder.ts`
- `packages/eval/src/fixture/seeders/bug-issue-seeder.ts`
- `packages/eval/src/fixture/seeders/issue-branch-seeder.ts`
- `packages/eval/test/unit/fixture/seeders/triage-issue-seeder.test.ts`
- `packages/eval/test/unit/fixture/seeders/bug-issue-seeder.test.ts`
- `packages/eval/test/unit/fixture/seeders/issue-branch-seeder.test.ts`
- `packages/eval/scenarios/issue-triage-and-assign-wf-001.json`
- `packages/eval/scenarios/issue-close-with-context-wf-001.json`
- `packages/eval/scenarios/issue-to-pr-lifecycle-wf-001.json`

### Modified
- `packages/eval/src/fixture/seeders/index.ts` — register 3 new seeders
- `packages/eval/src/fixture/manager.ts` — add `deleteBranch` method
- `packages/eval/src/hooks/eval-hooks.ts` — branch cleanup in `afterScenario`
- `packages/eval/scenarios/scenario-sets.json` — add `issue-only`, update `full`
- `packages/eval/test/unit/fixture/seeders/registry.test.ts` — test new registrations
- `packages/eval/test/unit/hooks/eval-hooks.test.ts` — test branch cleanup

# From 15 Tool Calls to 2: Stop Your AI Agent From Wasting Tokens on GitHub

*Your AI coding assistant is spending more time fighting GitHub's API than doing actual work. Here's the data — and a pattern to fix it.*

---

Watch an AI agent submit a PR review with inline comments. It calls `gh api`, gets a 422 error. Tries a different array syntax. Another 422. Switches to Python to JSON-encode the payload. Pipes it through `gh api --input -`. The inline comments vanish. It falls back to posting comments one at a time. Then submits the review event separately. Then verifies.

**15 tool calls. 126 seconds. For a task that should take one.**

This isn't a bug. It's the default experience for every AI agent that interacts with GitHub — Claude Code, Cursor, Windsurf, Copilot, or any custom agent you build. And it happens on almost every non-trivial GitHub operation.

I measured exactly how much waste this creates, ran a controlled evaluation across 30 runs, and built a tool that dramatically reduces it. Here's what I found.

![Without ghx: 15 tool calls, 126 seconds of chaotic API discovery. With ghx: 2 tool calls, 26 seconds.](images/hero-chaos-vs-clarity.png)

**The short version:** [ghx](https://github.com/aryeko/ghx) is an open-source execution router that gives AI agents pre-declared, typed GitHub capabilities instead of making them discover the API at runtime. It bundles ~70 operations (PR reviews, issue triage, releases, workflows) into single-call "capabilities" with structured input/output schemas, automatic GraphQL/CLI routing, and batch chaining — so the agent says *what* it wants, not *how* to call it.

> **TL;DR**
> - AI agents waste 60–70% of their GitHub tool calls on API discovery and retry — an average of **9 backtracking events per task**.
> - ghx pre-declares ~70 typed capabilities with automatic routing and chain batching, cutting tool calls by 73% and latency by 54% in a controlled 30-run evaluation.
> - The pattern is general: **pre-declared capability interfaces beat runtime API discovery** for any LLM-driven workflow.

> **Who this is for:** Agent builders integrating GitHub operations, developers tired of agents fighting `gh api` payloads, and anyone designing tool interfaces for LLMs.

---

## The problem nobody measures

AI agents are excellent at reasoning about code. They're terrible at discovering APIs at runtime.

Every time you start a new session and ask your agent to interact with GitHub, three things happen:

**1. It re-discovers the API surface from scratch.** Which `gh` subcommand handles PR review threads? What `--json` fields are available? Is it `gh pr review` or `gh api repos/{owner}/{repo}/pulls/{number}/reviews`? The agent figures this out by trial and error, every single session.

**2. It fights parameter encoding.** GitHub's REST API expects arrays in a specific format. `gh api` has its own opinions about how `-f 'comments[0][path]=...'` should work. The agent tries 3 to 15 syntaxes before finding one that doesn't 422.

**3. It parses inconsistent output shapes.** REST returns one shape. GraphQL returns another. `gh` CLI with `--json` returns a third. The agent burns tokens normalizing every response before it can reason about the result.

None of this is the agent's fault. These are legitimate complexities of GitHub's API surface. But the agent pays for them in tokens and time, on every session, for every developer, forever.

The question is: how much does this actually cost?

---

## The evaluation: 30 runs, 3 modes, real numbers

I ran a controlled evaluation to quantify the waste. Here's the setup:

- **Agent:** OpenAI Codex 5.3 (via OpenCode SSE provider)
- **Scenarios:** Two real GitHub tasks — reply to unresolved PR review threads, and submit a PR review with inline comments
- **Modes:** Three approaches, tested head-to-head
  - **Baseline** — raw `gh` CLI (what most agents use today)
  - **GitHub MCP Server** — the official Model Context Protocol server for GitHub
  - **ghx** — the tool I built
- **Iterations:** 5 per scenario per mode = 30 total runs
- **Statistics:** Permutation tests + bootstrap 95% confidence intervals (10,000 resamples)

Every run started from identical fixture-seeded GitHub state, reset between iterations. Same agent, same prompts, same repo state. The only variable was which tools were available.

### The headline numbers

![Benchmark comparison: ghx vs Raw gh CLI vs GitHub MCP across tool calls, wall-clock time, and success rate](images/benchmark-three-mode-comparison.png)

*p50 = median (50th percentile) — half the runs were faster/lower, half were slower/higher.*

| Metric | Baseline (raw `gh`) | GitHub MCP | ghx | ghx vs baseline |
|---|---|---|---|---|
| Tool calls (p50) | 8 | 7 | **2** | **-73%** |
| Wall-clock time (p50) | 69.8s | 38.9s | **32.4s** | **-54%** |
| Active tokens (p50) | 26,700 | 23,600 | **21,800** | **-18%** |
| Success rate | 90% | 100% | **100%** | +10pp |
| Variance (CV) | 0.40 | 0.14 | **0.17** | 3x more predictable |

All differences are statistically significant: p < 0.05, Cohen's d > 0.8 ("large" effect).

But the number that matters most isn't in this table.

### Backtracking: where the waste actually lives

I tracked **backtracking events** across all 30 runs.

![Backtracking events per task: Raw gh CLI averages 9, GitHub MCP 3.5, ghx just 1](images/benchmark-backtracking-events.png)

*A **backtracking event** is when the agent tries an approach, gets an error (e.g., a 422 from a malformed API call), and reverses course to try a different approach. Each one burns tokens on the failed attempt, the reasoning about what went wrong, and the retry.*

| Mode | Backtracking events per task |
|---|---|
| Baseline (raw `gh`) | **9** |
| GitHub MCP | 3.5 |
| ghx | **1** |

Baseline agents averaged **9 backtracking events per task**. Nine times per task, the agent tried something, failed, and tried again. Incorrect `gh api` endpoint paths. Array parameter syntax errors. GraphQL mutation formatting mistakes. Each backtrack costs tokens — the failed attempt, the reasoning about what went wrong, and the new attempt.

ghx agents averaged 1 backtracking event across both scenarios combined.

This is the core insight: **the cost isn't in the final successful API call. It's in the 8 failed attempts that precede it.**

---

## Where MCP still leaves room

The GitHub MCP Server helps — it gives the agent structured tools with defined inputs and outputs, and it eliminates the parsing headaches of raw CLI output. But look at the tool call numbers:

| Metric | GitHub MCP | ghx | Difference |
|---|---|---|---|
| Tool calls (p50) | 7 | **2** | **-71%** |
| Cohen's d | — | — | **3.417** (strongest signal in the dataset) |
| p-value | — | — | **< 0.001** |

MCP maps tools 1:1 with REST primitives — one MCP tool per GitHub API endpoint. This eliminates encoding pain but doesn't reduce the number of round trips. Triage an issue? That's still separate calls for removing a label, adding a label, assigning a user, and posting a comment.

The architectural difference is **composite operations**. ghx collapses multi-step workflows into a single call:

![Chain batching: 4 separate API calls without ghx vs 1 batched call with ghx](images/diagram-chain-batching.png)
*(Why "2 API round trips" in the diagram: 1. an ID-resolve query to map names → GitHub node IDs, 2. a single batched GraphQL mutation for all four operations.)*

```bash
ghx chain --steps - <<'EOF'
[
  {"task":"issue.labels.remove","input":{"owner":"acme","name":"repo","issueNumber":7,"labels":["triage"]}},
  {"task":"issue.labels.add","input":{"owner":"acme","name":"repo","issueNumber":7,"labels":["bug"]}},
  {"task":"issue.assignees.add","input":{"owner":"acme","name":"repo","issueNumber":7,"assignees":["alice"]}},
  {"task":"issue.comments.create","input":{"owner":"acme","name":"repo","issueNumber":7,"body":"Triaged as bug."}}
]
EOF
```

Four operations. One tool call. Internally, ghx resolves label names to GitHub node IDs, batches the mutations into a single GraphQL request, and returns one result. The agent doesn't manage IDs, doesn't sequence calls, and doesn't handle partial failures.

This is where the 71% tool call reduction over MCP comes from. Not from structured output — from eliminating round trips.

---

## How ghx works: three ideas

### 1. Operation cards declare the API surface upfront

Every GitHub capability is a YAML file — an "operation card" — that declares input schema, output schema, preferred route, and fallbacks:

```yaml
capability_id: pr.reviews.submit
version: "1.0.0"
description: Submit a pull request review with optional inline comments.

input_schema:
  type: object
  required: [owner, name, prNumber, event]
  properties:
    owner: { type: string }
    name: { type: string }
    prNumber: { type: integer }
    event: { enum: [APPROVE, REQUEST_CHANGES, COMMENT] }
    body: { type: string }
    comments: { type: array }  # items: path, line, body

routing:
  preferred: graphql
  fallbacks: [cli]
```

There are **~70 of these** across 6 domains: repos, issues, pull requests, workflows, projects v2, and releases.

The agent never discovers the API surface. It reads the capability list once and knows exactly what's available, what inputs are required, and what shape to expect back. No trial and error.

### 2. The routing engine chooses the best path automatically

The agent says "submit a PR review." ghx decides whether to use GraphQL or `gh` CLI based on the operation card's routing configuration, what's available, and suitability rules. If GraphQL fails (say, a permission issue), it automatically falls back to CLI.

The agent never thinks about GraphQL vs REST vs CLI. It just says what it wants.

### 3. Every response has the same shape

Success or failure, every operation returns the same envelope:

```json
{
  "ok": true,
  "data": { "id": "PR_kwDOOx...", "title": "fix: race condition", "state": "OPEN" },
  "meta": { "capability_id": "pr.view", "route_used": "graphql" }
}
```

On error:

```json
{
  "ok": false,
  "error": { "code": "NOT_FOUND", "message": "No PR with number 999", "retryable": false },
  "meta": { "capability_id": "pr.view", "route_used": "graphql" }
}
```

No parsing. No normalization. The agent checks `ok`, reads `data` or `error`, and moves on. The `retryable` flag tells it whether retrying is worth the tokens.

---

## What it looks like in practice

Here's the entire PR review scenario with ghx — 2 tool calls, 26 seconds:

```bash
# Call 1: Read the PR and diff in one chain
ghx chain --steps '[
  {"task":"pr.diff.view","input":{"owner":"acme","name":"repo","prNumber":42}},
  {"task":"pr.view","input":{"owner":"acme","name":"repo","prNumber":42}}
]'

# Call 2: Submit review with inline comments
ghx run pr.reviews.submit --input '{
  "owner":"acme","name":"repo","prNumber":42,
  "event":"REQUEST_CHANGES",
  "body":"Found blocking issues.",
  "comments":[
    {"path":"src/stats.ts","line":4,"body":"Empty array guard missing."},
    {"path":"src/stats.ts","line":8,"body":"Missing await on fetch."},
    {"path":"src/stats.ts","line":12,"body":"Hardcoded credential."}
  ]
}'
```

Compare that to the 15-call, 126-second baseline described in the intro. Same result. 87% fewer tool calls. 79% less time. Zero backtracking.

---

## Try it in 30 seconds

No install required:

```bash
npx @ghx-dev/core capabilities list
npx @ghx-dev/core run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

To teach your AI agent (Claude Code, Cursor, etc.) about ghx automatically:

```bash
npx @ghx-dev/core setup --scope project --yes
```

This installs a skill file that the agent reads on session start. It immediately knows all ~70 capabilities and how to use them.

For programmatic usage in your own agent:

```typescript
import { createGithubClientFromToken, executeTask } from "@ghx-dev/core"

const client = createGithubClientFromToken(process.env.GITHUB_TOKEN!)

const result = await executeTask(
  {
    task: "pr.reviews.submit",
    input: { owner: "acme", name: "repo", prNumber: 42, event: "APPROVE" },
  },
  { githubClient: client, githubToken: process.env.GITHUB_TOKEN! },
)
// result.ok === true — always a ResultEnvelope, never throws
```

---

## What ghx doesn't do

ghx handles deterministic GitHub API operations — the kind with well-defined inputs, outputs, and routing. It doesn't solve tasks that require human judgment (like issue prioritization or code review quality), and it doesn't help with non-GitHub APIs. The evaluation covers only two PR-focused scenarios with a single model (Codex 5.3); results may differ for other workflows or models. See the Reproducibility Appendix below for full methodology details.

---

## The broader pattern

ghx solves a specific problem — GitHub operations for AI agents — but the underlying pattern is general: **pre-declared, typed capability interfaces beat runtime API discovery for LLM-driven workflows.**

When you let an agent discover an API at runtime, you're paying for that discovery on every session, with every user, in tokens that add up fast. When you pre-declare the surface — input schemas, output shapes, routing logic — the agent skips straight to the work.

The data is clear: 73% fewer tool calls, 54% less time, 9 backtracking events down to 1. And that's just for GitHub. The same pattern applies anywhere agents interact with complex APIs.

If you're building agent tooling, consider: what API surface is your agent re-discovering on every session?

---

**ghx is open source (MIT) on GitHub:** [github.com/aryeko/ghx](https://github.com/aryeko/ghx)

**npm:** `npm i -g @ghx-dev/core`

*If this saved you tokens, star the repo. If you have ideas, open an issue. If you want to add capabilities, PRs are welcome.*

---

## Appendix: Reproducibility

**Sample size:** 30 total runs = 3 modes (baseline, MCP, ghx) x 2 scenarios x 5 iterations per cell.

**Agent choice:** OpenAI Codex 5.3 was chosen for strict reproducibility — its deterministic execution model makes it easier to isolate the toolset as the single independent variable. The patterns should generalize to other agents (Claude Code, Cursor, etc.), but cross-model evaluation is future work.

**Key definitions:**
- **Active tokens** = input + output tokens, excluding prefix-cached tokens. This isolates the tokens the model processes from scratch — the actual cost driver. (ghx's skill prompt is ~600 tokens and gets prefix-cached, so it has near-zero marginal cost.)
- **Success** = all checkpoints pass. Checkpoints verify actual GitHub state via API (e.g., "a CHANGES_REQUESTED review exists," "all 3 threads have replies") — functional correctness, not textual similarity.
- **Backtracking event** = the agent tries an approach, receives an error, and switches to a different approach in a subsequent tool call.

**Benchmark harness:** The evaluation framework (`@ghx-dev/eval`) is included in the [ghx monorepo](https://github.com/aryeko/ghx) under `packages/eval/`. Scenario definitions, fixture seeding, checkpoint scoring, and statistical analysis are all open source. The full evaluation report with per-iteration data is at `docs/eval-report.md` in the repo.

---

*Arye Kogan is a software engineer focused on developer tooling and AI agent infrastructure. He builds [ghx](https://github.com/aryeko/ghx).*

*Tags: AI Agents, Developer Tools, GitHub, API Design, Open Source*

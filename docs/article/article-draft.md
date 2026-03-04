# From 15 Tool Calls to 2: Stop Your AI Agent From Wasting Tokens on GitHub

*Your AI coding assistant is spending more time fighting GitHub's API than doing actual work. Here's the data — and the fix.*

---

Watch an AI agent submit a PR review with inline comments. It calls `gh api`, gets a 422 error. Tries a different array syntax. Another 422. Switches to Python to JSON-encode the payload. Pipes it through `gh api --input -`. The inline comments vanish. It falls back to posting comments one at a time. Then submits the review event separately. Then verifies.

**15 tool calls. 126 seconds. For a task that should take one.**

This isn't a bug. It's the default experience for every AI agent that interacts with GitHub — Claude Code, Cursor, Windsurf, Copilot, or any custom agent you build. And it happens on almost every non-trivial GitHub operation.

I measured exactly how much waste this creates, ran a controlled evaluation across 30 sessions, and built a tool that eliminates it. Here's what I found.

![Without ghx: 15 tool calls, 126 seconds of chaotic API discovery. With ghx: 2 tool calls, 26 seconds.](images/hero-chaos-vs-clarity.png)

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

I tracked "backtracking events" — moments where the agent tries an approach, gets an error, and reverses course to try something different.

![Backtracking events per task: Raw gh CLI averages 9, GitHub MCP 3.5, ghx just 1](images/benchmark-backtracking-events.png)

| Mode | Backtracking events per task |
|---|---|
| Baseline (raw `gh`) | **9** |
| GitHub MCP | 3.5 |
| ghx | **1** |

Baseline agents averaged **9 backtracking events per task**. Nine times per task, the agent tried something, failed, and tried again. Incorrect `gh api` endpoint paths. Array parameter syntax errors. GraphQL mutation formatting mistakes. Each backtrack costs tokens — the failed attempt, the reasoning about what went wrong, and the new attempt.

ghx agents averaged 1 backtracking event across both scenarios combined.

This is the core insight: **the cost isn't in the final successful API call. It's in the 8 failed attempts that precede it.**

---

## Why MCP isn't enough

The GitHub MCP Server helps — it gives the agent structured tools with defined inputs and outputs. But look at the tool call numbers:

| Metric | GitHub MCP | ghx | Difference |
|---|---|---|---|
| Tool calls (p50) | 7 | **2** | **-71%** |
| Cohen's d | — | — | **3.417** (strongest signal in the dataset) |
| p-value | — | — | **< 0.001** |

MCP reduces latency (agents don't fight encoding), but it doesn't reduce the number of calls. An agent still needs to call one MCP tool per GitHub operation. Triage an issue? That's separate calls for removing a label, adding a label, assigning a user, and posting a comment.

The architectural difference is **composite operations**. ghx collapses multi-step workflows into a single call:

![Chain batching: 4 separate API calls without ghx vs 1 batched call with ghx](images/diagram-chain-batching.png)

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
    comments:
      type: array
      items:
        type: object
        required: [path, line, body]
        properties:
          path: { type: string }
          line: { type: integer }
          body: { type: string }

routing:
  preferred: graphql
  fallbacks: [cli]
```

There are **70 of these** across 6 domains: repos, issues, pull requests, workflows, projects v2, and releases.

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

## The before and after

Here's the PR review scenario side by side.

**Without ghx** — 15 tool calls, 126 seconds:

```
gh pr view 42                                    # read PR
gh pr diff 42                                    # read diff
gh api POST reviews -f 'comments[0][path]=...'   # attempt 1 → 422
noglob gh api POST reviews ...                   # attempt 2 → 422
python3 -c "..." | gh api --input -              # attempt 3 → no inline comments
gh api POST reviews/comments -f path=...         # attempt 4-6 → individual comments
gh api POST reviews -f event=REQUEST_CHANGES     # attempt 7 → submit event
gh pr view 42 --json reviews                     # verify
```

**With ghx** — 2 tool calls, 26 seconds:

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

Same result. 87% fewer tool calls. 79% less time. Zero backtracking.

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

This installs a skill file that the agent reads on session start. It immediately knows all 70 capabilities and how to use them.

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

*Tags: AI Agents, Developer Tools, GitHub, API Design, Open Source*

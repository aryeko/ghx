# Eval Report

## Run Summary

| Property | Value |
| --- | --- |
| Run ID | `run_1772555729706` |
| Date | 2026-03-03 |
| Model | openai/gpt-5.3-codex |
| Provider | opencode |
| Modes | baseline, mcp, ghx |
| Scenarios | 2 |
| Iterations | 5 |
| Total Rows | 30 |

## Results at a Glance

| Mode | Success | Wall p50 | Wall p90 | Wall CV | Active Tok p50 | Cache Read p50 | Cache Ratio | Total Tok p50 | Reasoning Tok p50 | Tool Calls p50 | Tool Calls Max | Failed Calls | Agent Turns p50 | Cost p50 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| baseline | 🟢 90% | 69.8s | 81.7s | 🔴 0.40 | 26.7k | 102.1k | 78% | 130.1k | 929 | 8 | 11 | 🟢 0 | 7 | $0.0000 |
| mcp | 🟢 100% | 38.9s | 46.9s | 🟢 0.14 | 23.6k | 68.9k | 72% | 93.6k | 424 | 7 | 9 | 🟢 0 | 5 | $0.0000 |
| ghx | 🟢 100% | 32.4s | 41.2s | 🟢 0.17 | 21.8k | 49.0k | 76% | 62.0k | 404 | 2 | 3 | 🟢 0 | 3 | $0.0000 |


<details>
<summary>Metric Glossary</summary>

| Metric | Description |
| --- | --- |
| Success | Percentage of iterations where all checkpoints passed |
| Wall p50/p90 | Median and 90th percentile wall-clock time in seconds |
| Wall CV | Coefficient of variation for wall-clock time (stddev/mean); lower = more consistent |
| Active Tok p50 | Median active tokens (input + output, excluding cache) |
| Cache Read p50 | Median cache-read tokens per iteration |
| Cache Ratio | Total cache-read tokens / total tokens across all iterations |
| Total Tok p50 | Median total tokens (input + output + reasoning + cache) |
| Reasoning Tok p50 | Median reasoning/thinking tokens per iteration |
| Tool Calls p50/Max | Median and maximum tool calls per iteration |
| Failed Calls | Total failed tool calls across all iterations in this mode |
| Agent Turns p50 | Median number of agent conversation turns |
| Cost p50 | Median cost per iteration in USD |

</details>

## Statistical Comparison

> **Reduction:** A positive value means mode A used fewer resources than mode B. Negative means mode B was more efficient.

> **p-value:** Values below 0.05 indicate the observed difference is unlikely due to random chance alone, suggesting a real performance difference between the modes.

> **Cohen's d** quantifies how large the difference is in practice, independent of sample size. Values are classified as negligible (<0.2), small (0.2-0.5), medium (0.5-0.8), or large (>0.8). A large effect size means the distributions barely overlap.

> **95% CI** is a bootstrap confidence interval for the reduction percentage — if the interval excludes zero, the difference is robust.

### baseline vs mcp

| Metric | Median A | Median B | Reduction | 95% CI | Cohen's d | p-value |
| --- | --- | --- | --- | --- | --- | --- |
| Wall Time | 69821 ms | 38922 ms | -79.4% | 🟢 [-116.3%, -44.9%] | 🟢 1.294 (large) | 🟢 0.0120 |
| Active Tokens | 26.7k | 23.6k | -13.1% | 🔴 [-29.3%, 11.3%] | 🔴 0.036 (negligible) | 🔴 0.9550 |
| Tool Calls | 7.5 | 7.0 | -7.1% | 🔴 [-80.0%, 20.0%] | 🔴 0.175 (negligible) | 🔴 0.7450 |

### baseline vs ghx

| Metric | Median A | Median B | Reduction | 95% CI | Cohen's d | p-value |
| --- | --- | --- | --- | --- | --- | --- |
| Wall Time | 69821 ms | 32379 ms | -115.6% | 🟢 [-167.1%, -72.6%] | 🟢 1.646 (large) | 🟢 0.0040 |
| Active Tokens | 26.7k | 21.8k | -22.7% | 🟢 [-544.1%, -13.5%] | 🟢 0.978 (large) | 🟢 0.0390 |
| Tool Calls | 7.5 | 2.0 | -275.0% | 🟢 [-400.0%, -125.0%] | 🟢 1.836 (large) | 🟢 0.0030 |

### mcp vs ghx

| Metric | Median A | Median B | Reduction | 95% CI | Cohen's d | p-value |
| --- | --- | --- | --- | --- | --- | --- |
| Wall Time | 38922 ms | 32379 ms | -20.2% | 🟢 [-46.4%, -0.4%] | 🟢 1.134 (large) | 🟢 0.0150 |
| Active Tokens | 23.6k | 21.8k | -8.5% | 🔴 [-451.5%, 1.3%] | 🟢 1.286 (large) | 🟢 0.0110 |
| Tool Calls | 7.0 | 2.0 | -250.0% | 🟢 [-300.0%, -100.0%] | 🟢 3.417 (large) | 🟢 0.0000 |

## Tool Usage Breakdown

| Metric | baseline p50 | mcp p50 | ghx p50 | Description |
| --- | --- | --- | --- | --- |
| GHX Capabilities | 0 | 0 | 0 | GHX routing engine capability invocations |
| MCP Tools | 0 | 7 | 0 | MCP tool server calls |
| GH CLI Commands | 8 | 0 | 0 | GitHub CLI (gh) commands executed |
| Bash Commands | 0 | 0 | 2 | Shell commands executed |
| File Operations | 0 | 0 | 0 | File read/write/edit operations |
| Other Tools | 0 | 0 | 0 | Other tool invocations |

## Per-Scenario Results

### Reply to Unresolved Review Threads

> Agent must list unresolved review threads on a PR and reply to each with a concrete fix suggestion. No code changes or commits are expected — only GitHub API read/write calls.

- **Checkpoints:** 4
- **Success rate:** 🟢 100% (15/15)

| Iter | Mode | Success | Wall (s) | Active Tok | Cache Read | Tool Calls | Turns | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | baseline | 🟢 pass | 69.3s | 25.2k | 75.8k | 8 | 5 | $0.0000 |
| 0 | ghx | 🟢 pass | 26.1s | 22.6k | 39.2k | 2 | 3 | $0.0000 |
| 0 | mcp | 🟢 pass | 36.5s | 28.4k | 59.8k | 5 | 4 | $0.0000 |
| 1 | baseline | 🟢 pass | 82.8s | 30.8k | 132.7k | 11 | 8 | $0.0000 |
| 1 | ghx | 🟢 pass | 41.3s | 21.8k | 39.8k | 2 | 3 | $0.0000 |
| 1 | mcp | 🟢 pass | 32.7s | 28.3k | 60.3k | 5 | 4 | $0.0000 |
| 2 | baseline | 🟢 pass | 80.3s | 26.7k | 152.6k | 10 | 9 | $0.0000 |
| 2 | ghx | 🟢 pass | 27.8s | 21.7k | 39.8k | 2 | 3 | $0.0000 |
| 2 | mcp | 🟢 pass | 31.3s | 23.8k | 65.5k | 5 | 4 | $0.0000 |
| 3 | baseline | 🟢 pass | 41.8s | 24.5k | 34.9k | 2 | 3 | $0.0000 |
| 3 | ghx | 🟢 pass | 30.5s | 4.2k | 79.2k | 3 | 4 | $0.0000 |
| 3 | mcp | 🟢 pass | 38.8s | 30.2k | 98.3k | 7 | 6 | $0.0000 |
| 4 | baseline | 🟢 pass | 81.6s | 47.9k | 115.6k | 11 | 8 | $0.0000 |
| 4 | ghx | 🟢 pass | 35.5s | 3.3k | 58.5k | 2 | 3 | $0.0000 |
| 4 | mcp | 🟢 pass | 34.7s | 23.4k | 34.9k | 4 | 3 | $0.0000 |

### Review and Comment on PR

> Agent must review a PR diff, identify issues, and leave a constructive review comment.

- **Checkpoints:** 2
- **Success rate:** 🟢 93% (14/15)

| Iter | Mode | Success | Wall (s) | Active Tok | Cache Read | Tool Calls | Turns | Cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | baseline | 🟢 pass | 65.6s | 27.8k | 117.9k | 7 | 7 | $0.0000 |
| 0 | ghx | 🟢 pass | 41.1s | 17.6k | 64.9k | 3 | 4 | $0.0000 |
| 0 | mcp | 🟢 pass | 46.8s | 21.0k | 73.2k | 9 | 5 | $0.0000 |
| 1 | baseline | 🟢 pass | 70.3s | 26.7k | 110.3k | 6 | 7 | $0.0000 |
| 1 | ghx | 🟢 pass | 36.2s | 23.4k | 59.0k | 3 | 4 | $0.0000 |
| 1 | mcp | 🟢 pass | 43.8s | 21.4k | 72.2k | 8 | 5 | $0.0000 |
| 2 | baseline | 🟢 pass | 61.2s | 25.1k | 78.5k | 7 | 5 | $0.0000 |
| 2 | ghx | 🟢 pass | 25.2s | 22.0k | 39.8k | 2 | 3 | $0.0000 |
| 2 | mcp | 🟢 pass | 39.1s | 22.0k | 72.4k | 8 | 5 | $0.0000 |
| 3 | baseline | 🔴 FAIL | 0.0s | 0 | 0 | 0 | 0 | $0.0000 |
| 3 | ghx | 🟢 pass | 31.1s | 4.1k | 58.2k | 2 | 3 | $0.0000 |
| 3 | mcp | 🟢 pass | 41.5s | 21.7k | 88.8k | 7 | 6 | $0.0000 |
| 4 | baseline | 🟢 pass | 77.8s | 29.1k | 94.0k | 9 | 6 | $0.0000 |
| 4 | ghx | 🟢 pass | 33.6s | 23.1k | 39.2k | 2 | 3 | $0.0000 |
| 4 | mcp | 🟢 pass | 47.9s | 40.3k | 53.4k | 8 | 5 | $0.0000 |

## Checkpoint Detail

### Reply to Unresolved Review Threads

| Checkpoint | Condition | baseline | mcp | ghx |
| --- | --- | --- | --- | --- |
| `threads-still-unresolved` | All 3 unresolved threads remain unresolved — agent replied but did not mark them resolved | 🟢 100% | 🟢 100% | 🟢 100% |
| `thread-0-has-reply` | First unresolved thread has a reply (original comment + agent reply = 2 comments) | 🟢 100% | 🟢 100% | 🟢 100% |
| `thread-1-has-reply` | Second unresolved thread has a reply (original comment + agent reply = 2 comments) | 🟢 100% | 🟢 100% | 🟢 100% |
| `thread-2-has-reply` | Third unresolved thread has a reply (original comment + agent reply = 2 comments) | 🟢 100% | 🟢 100% | 🟢 100% |

### Review and Comment on PR

| Checkpoint | Condition | baseline | mcp | ghx |
| --- | --- | --- | --- | --- |
| `review-state-is-request-changes` | A REQUEST_CHANGES review was submitted on the PR | 🟢 100% | 🟢 100% | 🟢 100% |
| `inline-comments-exist` | At least one inline review thread was left on the PR | 🟢 100% | 🟢 100% | 🟢 100% |

## Efficiency Analysis

### Behavioral Efficiency

| Metric | baseline | ghx | mcp |
| --- | --- | --- | --- |
| Backtracking Events | 7 | 1 | 4 |

### Strategy Profile

| Metric | baseline | ghx | mcp |
| --- | --- | --- | --- |
| Tool Diversity | 2 | 2 | 3 |

### Reasoning Quality

| Metric | baseline | ghx | mcp |
| --- | --- | --- | --- |
| Reasoning Density | 0.7% | 0.6% | 0.5% |
| Reasoning / Tool Call | 116 tok | 183 tok | 63 tok |

## Failures & Anomalies

| Mode | Scenario | Iteration | Issue |
| --- | --- | --- | --- |
| baseline | pr-review-comment-001 | 3 | Failed (checkpoints not passed); Completion: error; Zero tokens; Zero wall time; Error: Prompt timed out after 120000ms |

## Data Exports

| File | Description |
| --- | --- |
| [data/results.json](data/results.json) | Full row-level data (JSON) |
| [data/results.csv](data/results.csv) | Full row-level data (CSV) |
| [data/summary.json](data/summary.json) | Aggregated summary with mode/scenario breakdowns |
| [sessions/](sessions/) | Raw session transcripts |
| [analysis/](analysis/) | Per-session analysis bundles |

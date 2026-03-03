---
"@ghx-dev/core": patch
---

Fix `ghx chain` compact output to surface response data for query and CLI steps.

Previously, all successful chain steps omitted `data` from compact output, forcing agents to re-run each step individually with `ghx run` to retrieve the response body. Query and CLI steps now include `data` in compact output. Mutation steps intentionally omit `data` since the raw GQL wrapper (e.g. `{addPullRequestReview: {pullRequestReview: {...}}}`) is not the normalized format agents expect.

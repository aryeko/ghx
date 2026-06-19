---
"@ghx-dev/core": minor
---

Fix several GitHub error-handling and input-defaulting issues surfaced by agent-usage analysis:

- `first` page-size now defaults (30) for list capabilities on both `ghx run` and `ghx chain` — previously chain steps that omitted `first` failed with a raw GraphQL `Int!` validation error.
- GitHub "Could not resolve to an Issue/PullRequest" responses now map to `NOT_FOUND` instead of `UNKNOWN`/`SERVER` (a PR number like 500 previously collided with the server-status regex), restoring the documented retry guidance.
- Input-validation errors on the single-`run` path now name the failing field instead of a generic "Input schema validation failed".
- New dedicated error codes: `NOT_READY` (retryable; e.g. workflow job logs not yet available) and `TOO_LARGE` (non-retryable; e.g. diff too large), replacing `UNKNOWN` for those conditions.

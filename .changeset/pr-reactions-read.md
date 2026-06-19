---
"@ghx-dev/core": minor
---

Add read-only reaction capabilities: `pr.reactions.list` and `pr.comments.reactions.list`.

- `pr.reactions.list` returns the emoji reaction groups on the pull request itself (the issue node).
- `pr.comments.reactions.list` returns reaction groups on the PR's issue comments and review-thread comments in a single call, each tagged with its subject; comments with no reactions are omitted.
- Both accept optional `reactorLogin` and `content` filters and follow the standard `{ ok, data, error, meta }` envelope, so a consumer can fetch the full review-readiness snapshot — including 👀/👍 reactions — inside one `ghx chain` alongside `pr.reviews.list`, `pr.threads.list`, `pr.checks.list`, and `pr.merge.status`.

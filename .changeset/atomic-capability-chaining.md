---
"@ghx-dev/core": minor
---

Add atomic capability chaining: `executeTasks()` function that executes multiple capabilities in a single GraphQL batch with ≤2 API round-trips. New `ghx chain --steps '<json-array>'` CLI command. Supersedes the unused composite capability system which has been removed.


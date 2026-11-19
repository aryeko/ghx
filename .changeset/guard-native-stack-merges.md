---
"@ghx-dev/core": patch
---

Check native stack membership before ordinary `pr.merge` dispatch. Stacked PRs require an explicit stack merge, including when an ordinary merge would have used the CLI for auto-merge, admin, or branch deletion.

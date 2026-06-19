---
"@ghx-dev/core": patch
---

Fix release-audit sync issues for list filtering, setup verification, and agent-facing docs.

- Forward `state` filters through `pr.list` and `issue.list` in both CLI and GraphQL routes.
- Make `ghx setup --verify` fail when the installed skill differs from the packaged skill.
- Sync the ghx skill, Cursor rules, capabilities reference, and CLI reference with the current registry and help output.
- Remove a stale `gql:generate` formatter path so GraphQL verification no longer emits a missing-directory diagnostic.

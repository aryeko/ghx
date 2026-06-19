---
"@ghx-dev/core": patch
---

Fix `ghx chain`: multi-step chains now return normalized per-step `.data` matching `ghx run` (previously raw GraphQL with dropped list items). Also fix `pr.checks.list` to return an empty result instead of an error when a branch has no checks. (#212)

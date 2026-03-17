---
"@ghx-dev/core": patch
---

Inline SessionStart hook logic and remove `scripts/plugin/ensure-ghx.sh`. The hook now runs directly as a shell command, scoped to `startup` source only (skips resume/clear/compact), and outputs a `systemMessage` via JSON stdout when `ghx` is not installed.

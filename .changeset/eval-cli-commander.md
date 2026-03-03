---
"@ghx-dev/eval": minor
---

Migrate eval CLI to commander: `--help` now works at every level without triggering config file reads. Remove `parse-flags.ts` in favour of commander option declarations. All CLI files reach ≥95% test coverage.

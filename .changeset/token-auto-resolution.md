---
"@ghx-dev/core": minor
---

Automatically resolve GitHub token from `gh auth token` when `GITHUB_TOKEN`/`GH_TOKEN` environment variables are not set, with 24-hour file-based caching and transparent 401 retry on the `run` command.

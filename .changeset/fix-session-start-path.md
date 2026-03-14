---
"@ghx-dev/core": patch
---

Fix SessionStart hook so ghx CLI is available on PATH. Replace bin/ghx symlink with a real executable script (symlinks don't survive plugin cache extraction), pass CLAUDE_PLUGIN_ROOT as env var to setup-env.sh (plugin variable substitution only expands in hooks.json command strings, not inside scripts).

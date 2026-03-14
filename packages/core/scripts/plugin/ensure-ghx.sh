#!/bin/bash
# Shared sessionStart hook for Claude Code and Cursor plugins.
# Warns if ghx is not available on PATH.

if ! command -v ghx &>/dev/null; then
  echo "Warning: ghx CLI not found. Install with: npm install -g @ghx-dev/core"
fi

exit 0

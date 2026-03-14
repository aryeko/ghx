#!/bin/bash
# Shared hook for Claude Code and Cursor plugins.
# 1. In Claude Code: add the plugin's bin/ to PATH via CLAUDE_ENV_FILE.
# 2. In all contexts: warn if ghx is not on PATH.

if [ -n "$CLAUDE_ENV_FILE" ] && [ -n "$CLAUDE_PLUGIN_ROOT" ]; then
  echo "export PATH=\"${CLAUDE_PLUGIN_ROOT}/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

if ! command -v ghx &>/dev/null && ! [ -x "${CLAUDE_PLUGIN_ROOT:-/nonexistent}/bin/ghx" ]; then
  echo "Warning: ghx CLI not found. Install with: npm install -g @ghx-dev/core"
fi

exit 0

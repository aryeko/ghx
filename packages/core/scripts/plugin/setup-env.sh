#!/bin/bash
# Add the plugin's CLI binary to PATH for the Claude Code session.
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo "export PATH=\"${CLAUDE_PLUGIN_ROOT}/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi
exit 0

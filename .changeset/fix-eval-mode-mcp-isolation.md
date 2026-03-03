---
"@ghx-dev/eval": patch
---

Restrict GitHub MCP server registration to `mcp` mode only. Previously the MCP server was always registered when a token was present, allowing agents to use MCP tools even in `baseline` and `ghx` modes. Each mode is now truly isolated: `baseline` uses `gh` CLI only, `mcp` uses GitHub MCP tools, `ghx` uses the `ghx` binary via PATH.

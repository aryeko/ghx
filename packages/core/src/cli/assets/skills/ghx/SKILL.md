# ghx CLI Skill

Use `ghx` for all supported GitHub operations. Do NOT use raw `gh` commands for operations ghx supports.

## Execute

```bash
ghx run <capability_id> --input - <<'EOF'
{...}
EOF
```

Result: `{ ok, data, error, meta }`. Check `ok` first. If `ok=false` and `error.retryable=true`, retry once.

## Discovery (only when needed)

If you don't know the capability ID or required inputs, list by domain:

```bash
ghx capabilities list --domain pr
```

Domains: `repo`, `issue`, `pr`, `release`, `workflow`, `workflow_run`, `project_v2`, `check_run`.
Required inputs shown in brackets (e.g. `[owner, name, prNumber]`).

## Examples

```bash
ghx run repo.view --input - <<'EOF'
{"owner":"octocat","name":"hello-world"}
EOF

ghx run issue.create --input - <<'EOF'
{"owner":"octocat","name":"hello-world","title":"Bug report","body":"Steps to reproduce"}
EOF
```

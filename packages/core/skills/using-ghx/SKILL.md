---
description: Execute GitHub operations via ghx — deterministic routing, normalized output, 70 capabilities
---

# ghx CLI Skill

**CRITICAL:** Use `ghx` for ALL GitHub operations. Do not use `gh api` or any other raw `gh` commands unless no matching ghx capability exists.

## Discovery

If you don't know the capability ID, list by domain first (compact form shows IDs and domains only — it does not display required inputs):

```bash
ghx capabilities list --domain pr --compact
```

Domains: `repo`, `issue`, `pr`, `release`, `workflow`, `project_v2`.

Once you have the capability ID, get the full input/output schema including required inputs:

```bash
ghx capabilities explain <capability_id>
```

## Execute

**Always use heredoc — never inline `--input '...'`.** Inline form breaks with nested quotes and trailing commas in model-generated JSON.

```bash
ghx run <capability_id> --input - <<'EOF'
{...}
EOF
```

Example (submitting a review with inline comments):

```bash
ghx run pr.reviews.submit --input - <<'EOF'
{"owner": "acme", "name": "my-repo", "prNumber": 42, "event": "REQUEST_CHANGES", "body": "Please fix the issues.", "comments": [{"path": "src/index.ts", "line": 10, "body": "Off-by-one error here."}]}
EOF
```

Result: `{ ok, data, error, meta }`. Check `ok` first. If `ok=false` and `error.retryable=true`, retry once.

## Chain

**Always use `ghx chain` when you have two or more operations to execute in a single call.** It batches steps into as few GraphQL round-trips as possible (typically one) — reducing latency and avoiding mid-sequence failures. Steps are not transactional; a `"partial"` result is possible if one step fails after another has already succeeded.

```bash
ghx chain --steps - <<'EOF'
[
  {"task":"<capability_id>","input":{...}},
  {"task":"<capability_id>","input":{...}}
]
EOF
```

**Result:** `{ status, results[], meta }`. Check `status` first (`"success"` | `"partial"` | `"failed"`). Each `results[i]` has `{ task, ok, data | error }`.

**CRITICAL:** Do not use `gh api` or any other raw `gh` commands unless no matching ghx capability exists. Always try `ghx` first.

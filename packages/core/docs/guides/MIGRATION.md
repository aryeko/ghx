# Migrating from raw gh CLI

This guide shows how to replace common `gh` CLI patterns with ghx equivalents. ghx provides validated input, deterministic routing, retries, and a stable output envelope -- eliminating the trial-and-error agents face with raw CLI calls.

## Common Patterns

### View a pull request

**Before (gh):**
```bash
gh pr view 42 --repo acme/repo --json title,body,state,author
```

**After (ghx):**
```bash
ghx run pr.view --input '{"owner":"acme","name":"repo","prNumber":42}'
```

ghx returns a normalized `ResultEnvelope` with all PR fields. No need to specify `--json` fields -- the operation card defines the output schema.

### Create an issue

**Before (gh):**
```bash
gh issue create --repo acme/repo --title "Bug report" --body "Description here" --label bug
```

**After (ghx):**
```bash
ghx run issue.create --input '{"owner":"acme","name":"repo","title":"Bug report","body":"Description here","labels":["bug"]}'
```

Array parameters like `labels` are passed as JSON arrays -- no shell escaping or quoting issues.

### GraphQL queries

**Before (gh):**
```bash
gh api graphql -f query='{ repository(owner:"acme", name:"repo") { pullRequest(number:42) { title body } } }'
```

**After (ghx):**
```bash
ghx run pr.view --input '{"owner":"acme","name":"repo","prNumber":42}'
```

ghx automatically selects GraphQL when it is the optimal route. The agent does not need to write queries.

### Multi-step workflows

**Before (gh):**
```bash
gh issue edit 42 --repo acme/repo --remove-label "triage"
gh issue edit 42 --repo acme/repo --add-label "enhancement"
gh issue comment 42 --repo acme/repo --body "Triaged as enhancement."
```

**After (ghx):**
```bash
ghx chain --steps - <<'EOF'
[
  {"task":"issue.labels.remove","input":{"owner":"acme","name":"repo","issueNumber":42,"labels":["triage"]}},
  {"task":"issue.labels.add","input":{"owner":"acme","name":"repo","issueNumber":42,"labels":["enhancement"]}},
  {"task":"issue.comments.create","input":{"owner":"acme","name":"repo","issueNumber":42,"body":"Triaged as enhancement."}}
]
EOF
```

Three shell commands become one `ghx chain` call -- one tool call instead of three.

## Updating Agent System Prompts

To migrate an agent from raw `gh` to ghx:

1. Install ghx globally:
   ```bash
   npm i -g @ghx-dev/core
   ```

2. Install the ghx skill into your project:
   ```bash
   ghx setup --scope project --yes
   ```

3. Verify the installation:
   ```bash
   ghx setup --scope project --verify
   ```

3. Remove any `gh` CLI instructions from your agent's system prompt. The installed `SKILL.md` teaches the agent how to discover and use ghx capabilities.

For the full before/after comparison showing token and latency savings, see the [root README](../../../../README.md#before--after).

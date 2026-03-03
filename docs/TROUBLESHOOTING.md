# Troubleshooting

## Setup Issues

### `GITHUB_TOKEN` or `GH_TOKEN` not set

**Symptom:** ghx returns an error about missing authentication.

**Cause:** ghx requires a GitHub token in the environment to authenticate API requests.

**Fix:**
```bash
export GITHUB_TOKEN="ghp_your_token_here"
# or
export GH_TOKEN="ghp_your_token_here"
```

### `gh` CLI not authenticated

**Symptom:** CLI-routed capabilities fail with authentication errors.

**Cause:** The `gh` CLI is installed but not logged in.

**Fix:**
```bash
gh auth login
gh auth status  # verify
```

### Node.js version mismatch

**Symptom:** Startup errors or unexpected syntax failures.

**Cause:** ghx requires Node.js 22 or later.

**Fix:**
```bash
node --version  # must be >= 22
nvm install 22  # if using nvm
```

## Runtime Errors

### Route failure: CLI adapter cannot find `gh`

**Symptom:** `PREFLIGHT_FAILED` error when using CLI-routed capabilities.

**Cause:** The `gh` CLI is not installed or not in PATH.

**Fix:**
```bash
# Install gh CLI: https://cli.github.com/
gh --version
gh auth status
```

### GraphQL authentication errors

**Symptom:** GraphQL-routed capabilities return `AUTH` error code.

**Cause:** The `GITHUB_TOKEN` lacks required scopes, or is expired.

**Fix:**
- Verify token scopes: `gh auth status`
- For fine-grained tokens, ensure `Metadata`, `Contents`, `Pull requests`, `Issues`, `Actions`, and `Projects` read permissions are granted
- For classic PATs, ensure `repo` scope is present

### Rate limiting

**Symptom:** `RATE_LIMIT` error code in the ResultEnvelope.

**Cause:** GitHub API rate limit exceeded.

**Fix:**
- Wait for the rate limit window to reset (check `X-RateLimit-Reset` header)
- Use a token with higher rate limits
- ghx automatically retries rate-limited requests, but sustained heavy usage will still hit limits

## Development Issues

### Biome format failures

**Symptom:** `pnpm run format:check` fails in CI or pre-commit.

**Cause:** Code does not match Biome's formatting rules.

**Fix:**
```bash
pnpm run format  # auto-fix all formatting issues
```

### Lefthook hook failures

**Symptom:** Commit is rejected by pre-commit hooks.

**Cause:** Format, lint, or typecheck errors in staged files.

**Fix:**
```bash
pnpm run format       # fix formatting
pnpm run lint         # check lint errors
pnpm run typecheck    # check type errors
```

### GraphQL schema drift

**Symptom:** Generated GraphQL types are out of date.

**Cause:** `.graphql` operation files were changed without regenerating types.

**Fix:**
```bash
pnpm run ghx:gql:verify  # verify operations are in sync
```

## Common CI Failures

### Typecheck errors

**Symptom:** `pnpm run typecheck` fails.

**Cause:** TypeScript strict mode violations. Common culprits: `exactOptionalPropertyTypes` conflicts with Zod's `.optional()`, missing `.js` extensions in imports.

**Fix:**
- For Zod optional conflicts: cast the result (e.g., `as Promise<ProfileRow[]>`)
- For missing extensions: add explicit `.js` to relative imports

### Test isolation issues

**Symptom:** Tests pass individually but fail when run together.

**Cause:** Shared mutable state between tests, or missing mock cleanup.

**Fix:**
- Ensure each test sets up and tears down its own state
- Use `vi.restoreAllMocks()` in `afterEach`

### Coverage threshold not met

**Symptom:** `pnpm run test:coverage` fails with coverage below threshold.

**Cause:** New code lacks sufficient test coverage.

**Fix:**
- Add unit tests for new functions and branches
- Target >=90% coverage for touched files (aim for 95%)
- Run `pnpm run test:coverage` locally to check before pushing

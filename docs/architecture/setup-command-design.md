# Setup Command Design: `ghx setup` for Platform Onboarding

**Status:** Planned  
**Date:** 2026-02-14  
**Audience:** Core CLI maintainers, OSS maintainers, integration owners

---

## 1) Motivation

`ghx` has strong capability depth, but OSS adoption depends on how quickly users can install, configure, and verify value in real environments.

Today, setup across agent platforms is manual and error-prone:

- users must know platform-specific config paths,
- users must patch hook/settings files correctly,
- users frequently misconfigure user vs project scope,
- verification is inconsistent.

The result is high time-to-first-success and support overhead that is unrelated to core capability quality.

`ghx setup` addresses this by creating a deterministic, safe, idempotent onboarding flow.

---

## 2) Goals

1. Provide a single CLI command to install and verify ghx integration for supported platforms.
2. Support both scopes in v1: `user` and `project`.
3. Preserve existing user config via additive merge and backup policy.
4. Offer deterministic dry-run and verification output.
5. Reduce install-to-first-success time to under 5 minutes.

## 3) Non-goals

- Managing all user customizations beyond required setup changes.
- Auto-fixing arbitrary invalid platform configs outside ghx-owned sections.
- Supporting all possible platforms in v1.

---

## 4) CLI Contract

Primary command:

```bash
ghx setup --platform <claude-code|opencode> --scope <user|project> [--profile pr-review-ci] [--dry-run] [--verify] [--yes]
```

Behavioral rules:

- If `--platform` or `--scope` is missing, run an interactive two-question prompt.
- `--dry-run`: print planned actions only, write nothing.
- `--verify`: run verification checks only (no writes).
- `--yes`: non-interactive approval for writes.

Output must be human-readable by default and machine-parseable JSON may be added later.

---

## 5) Scope and Platform Model

### 5.1 Scope resolution

- `user` scope targets user-level platform configuration directories.
- `project` scope targets repository-local configuration directories.

Examples (subject to adapter ownership):

- user-level: `~/.claude/...`
- project-level: `./.claude/...`

### 5.2 Platform adapters

Implement a platform adapter abstraction:

- `resolvePaths(scope)`
- `readConfig()`
- `planChanges(profile)`
- `applyChanges(plannedChanges)`
- `verify(profile)`

Initial adapters:

- `claude-code`
- `opencode`

---

## 6) Profile Model

Initial profile:

- `pr-review-ci`

Profile includes:

- required config/hook entries,
- required command wiring,
- recommended default flow command printed post-setup.

Profiles are declarative manifests and should avoid hardcoded user-specific paths where possible.

---

## 7) Write Safety and Idempotency

### 7.1 Merge strategy

- Additive merge only for known ghx-owned sections.
- Do not remove or rewrite unrelated user config.

### 7.2 Backup strategy

- Before writing a modified file, create a timestamped backup.
- Backup naming must be deterministic and easy to clean.

### 7.3 Idempotency

- Re-running the same command on an already-configured target must produce no-op results.
- No-op runs must state `already configured` clearly.

---

## 8) Verification Design

`ghx setup --verify` checks:

1. required files exist,
2. required config keys/hooks are present,
3. configured command paths are valid,
4. profile-level dependency checks pass.

Verification output:

- per-check PASS/FAIL,
- concise remediation hints per failure,
- final status summary.

Optional post-setup behavior:

- auto-run verify after successful apply.

---

## 9) Requirements

### 9.1 Functional requirements

1. Command supports both `user` and `project` scopes in v1.
2. Command supports both `claude-code` and `opencode` in v1.
3. Interactive fallback prompts only for missing required flags.
4. `--dry-run` prints exact planned file changes with no writes.
5. `--verify` runs read-only validation checks.
6. Setup emits a golden follow-up command proving immediate value.

### 9.2 Quality requirements

1. Setup behavior is deterministic across repeated runs.
2. Write plan and apply output are concise and auditable.
3. Errors are actionable and include exact failing path/key when possible.
4. Platform adapter behavior is unit-testable without live platform dependency.

### 9.3 Safety requirements

1. No silent overwrite of modified files.
2. Backups are created before destructive write operations.
3. No secrets are logged in setup output.
4. Partial failure reports list applied vs unapplied changes.

---

## 10) Validation Plan

### 10.1 Unit validation

- argument parser tests (`--dry-run`, `--verify`, `--yes`, interactive fallback),
- scope path resolution tests,
- merge planner tests (existing config preserved),
- idempotency tests,
- backup naming and creation tests,
- platform adapter contract tests.

### 10.2 Integration validation

- fixture-based integration tests for both platforms and both scopes,
- dry-run vs apply parity tests,
- verify command integration tests for positive and failure cases.

### 10.3 Release-gate commands

```bash
pnpm --filter @ghx/core run typecheck
pnpm --filter @ghx/core run lint
pnpm --filter @ghx/core run test
```

---

## 11) Rollout

1. Implement CLI command skeleton and argument parsing.
2. Implement scope resolver and platform adapter abstraction.
3. Implement `pr-review-ci` profile manifest.
4. Implement dry-run planner and apply engine with backups.
5. Implement verify checks and post-setup summary.
6. Add docs examples to `README.md` and architecture references.

---

## 12) Acceptance Criteria

1. `ghx setup` succeeds for both platforms and both scopes in test fixtures.
2. Re-running setup returns no-op status when already configured.
3. `--dry-run` and `--verify` are reliable and produce actionable output.
4. Backup files are created when modifications occur.
5. Setup-to-verify path can be completed in less than 5 minutes by a new user.

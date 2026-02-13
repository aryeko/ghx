# Changesets and Publishing

This repo uses Changesets for versioning and release PR/publish automation.

## Local Commands

- `pnpm run changeset` - create a new changeset entry.
- `pnpm run changeset:status` - inspect pending release state.
- `pnpm run changeset:version` - apply version updates.
- `pnpm run changeset:publish` - publish release artifacts.

## CI Behavior

- Main workflow runs release logic after successful `build-and-test`.
- Release behavior is keyed off version commits with message:
  - `chore: version packages`
- Dist artifacts are restored before publish.

## Contribution Guidance

- Add a changeset for user-facing changes.
- Keep changeset summaries concise and user-oriented.
- Ensure `pnpm run ci` passes before merging.

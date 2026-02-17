#!/usr/bin/env bash
set -euo pipefail

# Usage: pnpm run agent:run [-- --branch <name>] [-- --prompt "task"] [-- --interactive]
#
# Creates a git worktree, starts a devcontainer, and runs Claude Code inside it.
#
# Options:
#   --branch <name>    Branch name for the worktree (default: agent/<timestamp>)
#   --prompt <text>    Task prompt for Claude (default: interactive mode)
#   --interactive      Open an interactive shell instead of running a prompt
#   --cleanup          Remove the worktree and stop the container after completion

REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_BASE="$REPO_ROOT/.worktrees"
BRANCH=""
PROMPT=""
INTERACTIVE=false
CLEANUP=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --branch)  BRANCH="$2"; shift 2 ;;
    --prompt)  PROMPT="$2"; shift 2 ;;
    --interactive) INTERACTIVE=true; shift ;;
    --cleanup) CLEANUP=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Generate branch name if not provided
if [ -z "$BRANCH" ]; then
  BRANCH="agent/$(date +%Y%m%d-%H%M%S)"
fi

WORKTREE_DIR="$WORKTREE_BASE/$BRANCH"

echo "==> Creating worktree at $WORKTREE_DIR (branch: $BRANCH)"
mkdir -p "$WORKTREE_BASE"
git worktree add "$WORKTREE_DIR" -b "$BRANCH" HEAD

if [ ! -d "$WORKTREE_DIR/.devcontainer" ]; then
  echo "ERROR: .devcontainer/ not found in worktree. Commit it to the repo first."
  exit 1
fi

echo "==> Starting devcontainer..."
devcontainer up --workspace-folder "$WORKTREE_DIR"

cleanup() {
  if [ "$CLEANUP" = true ]; then
    echo "==> Cleaning up worktree $WORKTREE_DIR"
    git worktree remove "$WORKTREE_DIR" --force 2>/dev/null || true
    git branch -D "$BRANCH" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [ "$INTERACTIVE" = true ]; then
  echo "==> Opening interactive shell (Claude available inside)..."
  devcontainer exec --workspace-folder "$WORKTREE_DIR" zsh
elif [ -n "$PROMPT" ]; then
  echo "==> Running Claude with prompt..."
  devcontainer exec --workspace-folder "$WORKTREE_DIR" \
    claude --dangerously-skip-permissions -p "$PROMPT"
else
  echo "==> Running Claude interactively..."
  devcontainer exec --workspace-folder "$WORKTREE_DIR" \
    claude --dangerously-skip-permissions
fi

#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

package_manager=$(node -p 'require("./package.json").packageManager')
if [[ "$package_manager" != pnpm@* ]]; then
  echo "Expected a pnpm version in package.json's packageManager field." >&2
  exit 1
fi
pnpm_version=${package_manager#pnpm@}
pnpm_version=${pnpm_version%%+*}

if [[ "$(pnpm --version 2>/dev/null)" == "$pnpm_version" ]]; then
  exit 0
fi

npm install --global "pnpm@$pnpm_version"
if [[ "$(pnpm --version)" != "$pnpm_version" ]]; then
  echo "Expected pnpm $pnpm_version on PATH. Check which pnpm your shell uses." >&2
  exit 1
fi

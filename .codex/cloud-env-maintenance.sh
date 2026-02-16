#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${REPO_ROOT}"

./scripts/setup-dev-env.sh
pnpm install --frozen-lockfile
pnpm run build

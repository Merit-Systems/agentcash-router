#!/usr/bin/env bash
# changeset-guard.sh — Block PRs that manually edit package.json version.
#
# Usage (in CI):
#   BASE_REF=main ./scripts/changeset-guard.sh
#
# The changesets/action bot is the ONLY actor allowed to bump package.json version.
# Human PRs should run `pnpm changeset` and commit the .changeset/*.md file only.

set -euo pipefail

BASE_REF="${BASE_REF:-main}"
BASE=$(git merge-base "origin/${BASE_REF}" HEAD)

VERSION_CHANGED=$(git diff "$BASE" HEAD -- package.json | grep -E '^[+-]\s*"version"' || true)
CHANGESET_ADDED=$(git diff --diff-filter=A --name-only "$BASE" HEAD -- '.changeset/*.md' | grep -v '^.changeset/README\.md$' || true)

if [ -n "$VERSION_CHANGED" ] && [ -z "$CHANGESET_ADDED" ]; then
  echo "::error::package.json 'version' was modified but no .changeset/*.md was added."
  echo "Run \`pnpm changeset\` and commit the generated file. Do not edit package.json version directly."
  exit 1
fi

if [ -n "$VERSION_CHANGED" ] && [ -n "$CHANGESET_ADDED" ]; then
  echo "::error::package.json 'version' was modified directly. Let \`changesets/action\` bump versions on the 'chore: version packages' PR — your PR should add the changeset only."
  exit 1
fi

echo "✅ No manual version bump detected."

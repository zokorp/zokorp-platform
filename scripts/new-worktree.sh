#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/new-worktree.sh <feature-name> [base-ref] [worktree-root]

Examples:
  scripts/new-worktree.sh architecture-diagram-reviewer
  scripts/new-worktree.sh landing-zone-readiness origin/main ../zokorp-worktrees

Defaults:
  base-ref: origin/main
  worktree-root: ../zokorp-worktrees

Output:
  - Creates branch codex/<feature-name> (if missing)
  - Creates a dedicated git worktree directory for that branch
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -lt 1 ]]; then
  usage
  exit 0
fi

feature_raw="$1"
base_ref="${2:-origin/main}"
worktree_root="${3:-../zokorp-worktrees}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: run this script from inside a git repository."
  exit 1
fi

feature_slug="$(echo "$feature_raw" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+//; s/-+$//')"
if [[ -z "$feature_slug" ]]; then
  echo "Error: feature-name resolves to an empty slug."
  exit 1
fi

branch_name="codex/$feature_slug"
worktree_path="$worktree_root/$feature_slug"

mkdir -p "$worktree_root"
git fetch origin --prune

if [[ -e "$worktree_path" ]]; then
  echo "Error: worktree path already exists: $worktree_path"
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$branch_name"; then
  git worktree add "$worktree_path" "$branch_name"
elif git ls-remote --exit-code --heads origin "$branch_name" >/dev/null 2>&1; then
  git worktree add "$worktree_path" -b "$branch_name" "origin/$branch_name"
else
  git rev-parse --verify --quiet "$base_ref" >/dev/null || {
    echo "Error: base ref not found: $base_ref"
    exit 1
  }
  git worktree add "$worktree_path" -b "$branch_name" "$base_ref"
fi

echo
echo "Created:"
echo "  Branch:   $branch_name"
echo "  Worktree: $worktree_path"
echo
echo "Next:"
echo "  cd \"$worktree_path\""
echo "  git status"


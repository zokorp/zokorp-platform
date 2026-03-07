# Codex Parallel Workflow (One Repo, Many Threads)

This operating model lets you run multiple Codex threads safely in one repo.

## Goal
- Keep one website repo.
- Run one branch per feature/thread.
- Avoid branch/file collisions.
- Merge safely with as little manual work as possible.

## Core rules
1. `main` is protected and never used for direct feature work.
2. Every thread gets its own branch named `codex/<feature-slug>`.
3. Every thread gets its own git worktree folder.
4. Every branch must pass CI before merge.
5. PRs ready for automatic merge get label `automerge`.

## Create a new thread workspace
From repo root:

```bash
scripts/new-worktree.sh architecture-diagram-reviewer
```

This creates:
- Branch: `codex/architecture-diagram-reviewer`
- Worktree folder: `../zokorp-worktrees/architecture-diagram-reviewer`

Open that folder in a dedicated Codex thread/window.

## Daily working loop per thread
Inside the thread worktree:

```bash
git fetch origin
git rebase origin/main
npm run lint
npm run typecheck
npm test
git push --force-with-lease
```

## Merge model
- CI workflow: `.github/workflows/ci.yml`
- Label workflow: `.github/workflows/automerge-labeled-prs.yml`
- Weekly Zoho sync remains: `.github/workflows/zoho-sync-leads.yml`

How merge happens:
1. PR gets green checks.
2. Add label `automerge`.
3. Scheduled workflow enables GitHub auto-merge for that PR.
4. GitHub merges when branch protection and queue rules are satisfied.

## Suggested branch protection on `main`
- Require pull request before merging
- Require at least 1 approval
- Dismiss stale approvals
- Require conversation resolution
- Require status checks:
  - `ci / lint`
  - `ci / typecheck`
  - `ci / test`
  - `ci / build`
- Require merge queue
- Disable force push and delete

## Thread prompt template
Use this when starting a new Codex thread:

```txt
You are working in branch codex/<feature-slug> inside worktree <absolute-path>.
Scope: only files for <feature>.
Do not edit unrelated files.
Run lint/typecheck/tests before done.
Open or update PR for this branch.
```

## Conflict policy
- If two threads need the same shared file, pick one owner thread for that file.
- Other thread waits or rebases after owner PR merges.
- Keep PRs small (1 feature, 1 branch, 1 PR).


# Automation Senior Engineer Playbook

This file is the operating contract for the `ZoKorp release hardening` automation.

## Core rules

1. Treat [docs/platform-improvement-backlog.md](/Users/zohaibkhawaja/Documents/Codex/zokorp-platform/docs/platform-improvement-backlog.md) as the source of truth.
2. Work from top to bottom and pick exactly one `[TODO][AUTO]` item per run.
3. Skip `[TODO][MANUAL]` items unless the missing human input has already been provided in the repo or environment.
4. Prefer the smallest complete safe slice that closes a backlog item end to end.
5. Never use destructive git commands, never overwrite unrelated user work, and never silently reorder the backlog.

## Run sequence

1. Read the backlog and identify the first actionable `[TODO][AUTO]` item.
2. Sync with `origin/main` using a non-destructive fast-forward workflow.
3. Re-review the relevant code paths before changing anything.
4. Implement the item fully.
5. Update the backlog item status:
   - Change `[TODO]` to `[DONE]` when finished.
   - Change `[TODO]` to `[BLOCKED]` only when an external dependency or policy blocks progress.
   - Change `[TODO]` to `[DEFERRED]` only when the item no longer makes sense.
6. Add a short evidence note directly below the updated backlog item.
7. Run validation:
   - `npm install` only if dependencies are missing or lockfiles changed.
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
   - If `npm run build` fails with a sandbox-specific Turbopack runtime restriction such as `Operation not permitted` during process binding, rerun `npm run build:webpack` and treat a passing webpack build as the required production-build verification for that run.
   - `node scripts/production_smoke_check.mjs` when public routes changed and `SMOKE_BASE_URL` is configured.

## Git and GitHub workflow

1. Push directly to `main` only when repo policy allows it and all checks pass.
2. If direct push to `main` is blocked:
   - Push a `codex/` branch.
   - Verify GitHub CLI access with `gh auth status`.
   - If GitHub API or DNS access fails during `gh` operations, retry the failing `gh` command up to 3 times with short backoff before treating it as a blocker.
   - Create or update a PR targeting `main`.
   - Reuse an existing PR for the same branch instead of creating duplicates.
   - Add the `automerge` label when the PR is ready.
   - Enable auto-merge with squash merge when policy allows it.
3. If CI is running for the PR branch, inspect it with `gh pr checks` and `gh run` commands before deciding whether to merge or wait.

## Stop condition

If there are no remaining `[TODO][AUTO]` items in the backlog, pause the automation by running:

```bash
python3 /Users/zohaibkhawaja/Documents/Codex/zokorp-platform/scripts/update_codex_automation.py \
  --path /Users/zohaibkhawaja/.codex/automations/zokorp-release-hardening/automation.toml \
  --status PAUSED
```

Then stop without making code changes.

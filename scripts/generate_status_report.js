#!/usr/bin/env node

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function run(command) {
  return execSync(command, { encoding: "utf8" }).trim();
}

function safeRun(command) {
  try {
    return run(command);
  } catch {
    return "";
  }
}

const now = new Date();
const date = now.toISOString().slice(0, 10);
const statusDir = path.join(process.cwd(), "docs", "status");
const outFile = path.join(statusDir, `${date}.md`);

fs.mkdirSync(statusDir, { recursive: true });

const branch = safeRun("git branch --show-current");
const head = safeRun("git rev-parse --short HEAD");
const commitCount = safeRun("git rev-list --count --since='7 days ago' HEAD") || "0";
const recentCommits = safeRun("git log --since='7 days ago' --pretty=format:'- %h %s (%an, %ad)' --date=short -n 20");
const changedFiles = safeRun(
  "git log --since='7 days ago' --name-only --pretty=format: | sed '/^$/d' | sort | uniq -c | sort -nr | head -n 20",
);

const report = `# Product + Engineering Weekly Status (${date})

## Snapshot
- Branch analyzed: ${branch || "unknown"}
- Head commit: ${head || "unknown"}
- Commits in last 7 days: ${commitCount}

## Highlights (last 7 days)
${recentCommits || "- No commits in the last 7 days."}

## Most touched files (last 7 days)
${
  changedFiles
    ? changedFiles
        .split("\n")
        .filter(Boolean)
        .map((line) => `- ${line.trim()}`)
        .join("\n")
    : "- No file changes detected in the last 7 days."
}

## Risks / Watchlist
- Review authentication and billing changes before merging.
- Verify Stripe webhook and runner API key rotation policy.
- Confirm migration application status across environments.

## Next Actions
- Validate preview environment for latest merged features.
- Close or re-prioritize stale issues in backlog.
- Confirm uptime/error trends and update monitoring thresholds.
`;

fs.writeFileSync(outFile, report, "utf8");
console.log(`Wrote ${outFile}`);

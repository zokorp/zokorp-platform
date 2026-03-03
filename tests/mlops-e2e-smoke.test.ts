import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const REQUIRED_FILES = [
  "app/mlops/page.tsx",
  "app/mlops/projects/page.tsx",
  "app/mlops/projects/[id]/page.tsx",
  "app/mlops/runs/page.tsx",
  "app/mlops/models/page.tsx",
  "app/mlops/deployments/page.tsx",
  "app/mlops/monitoring/page.tsx",
  "app/mlops/settings/billing/page.tsx",
  "app/mlops/settings/organization/page.tsx",
  "app/api/mlops/jobs/route.ts",
  "app/api/mlops/runner/pull-job/route.ts",
  "app/api/mlops/runner/report-job/route.ts",
  "packages/zokorp-runner/src/cli.js",
];

describe("mlops smoke paths", () => {
  it("contains required UI and API surfaces", async () => {
    for (const relativePath of REQUIRED_FILES) {
      const absolutePath = path.join(ROOT, relativePath);
      await expect(fs.access(absolutePath)).resolves.toBeUndefined();
    }
  });
});

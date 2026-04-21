/* @vitest-environment node */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Contract: each product tree imports only from the design system
// (components/ui/*), shared libs, or its own tree. Cross-product imports
// are a contract violation.
//
// Documented at docs/software-isolation-contract.md.

const PRODUCT_TREES = {
  "architecture-diagram-reviewer": "components/architecture-diagram-reviewer",
  "validator": "components/validator",
  "mlops": "components/mlops",
} as const;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, out);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(fullPath);
    }
  }
  return out;
}

const projectRoot = resolve(__dirname, "..");

describe("software isolation contract", () => {
  for (const [productKey, productDir] of Object.entries(PRODUCT_TREES)) {
    it(`${productKey} tree contains no imports from sibling product trees`, () => {
      const absoluteDir = resolve(projectRoot, productDir);
      const files = walk(absoluteDir);
      const forbiddenAliases = Object.entries(PRODUCT_TREES)
        .filter(([otherKey]) => otherKey !== productKey)
        .map(([, otherDir]) => `@/${otherDir}`);

      const offenders: Array<{ file: string; importPath: string }> = [];
      const importRegex = /from\s+['"]([^'"\s]+)['"]/g;

      for (const file of files) {
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(importRegex)) {
          const importPath = match[1];
          if (forbiddenAliases.some((alias) => importPath.startsWith(alias))) {
            offenders.push({ file: file.replace(`${projectRoot}/`, ""), importPath });
          }
        }
      }

      expect(offenders).toEqual([]);
    });
  }

  it("product trees only import components from the two sanctioned shared layers", () => {
    // Sanctioned shared layers:
    //   components/ui/*       — design system primitives
    //   components/software/* — software-platform primitives (access banners,
    //                            engagement guides, shared across tools)
    // Everything else under components/* must live inside the product's own
    // tree.
    const offenders: Array<{ file: string; importPath: string }> = [];

    for (const productDir of Object.values(PRODUCT_TREES)) {
      const absoluteDir = resolve(projectRoot, productDir);
      const files = walk(absoluteDir);
      const importRegex = /from\s+['"]([^'"\s]+)['"]/g;

      for (const file of files) {
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(importRegex)) {
          const importPath = match[1];
          if (!importPath.startsWith("@/components/")) continue;

          const allowed =
            importPath.startsWith("@/components/ui/") ||
            importPath.startsWith("@/components/software/") ||
            importPath.startsWith(`@/${productDir}/`);

          if (!allowed) {
            offenders.push({ file: file.replace(`${projectRoot}/`, ""), importPath });
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

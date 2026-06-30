#!/usr/bin/env node
// CITE-09: verify every officialSourceLinks documentation URL the paid report can cite still resolves
// with a clean 200 — no 404, no redirect (a redirect-dependent URL is fragile and silently rots). Run
// on a schedule (.github/workflows/citation-link-check.yml) and locally before changing a catalog.
//
// Usage: node scripts/check_citation_links.mjs
// Exit 0 if all URLs return 200; exit 1 if any return a non-200 status, a redirect, or fail to fetch.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const CATALOG_DIR = path.resolve("lib/architecture-review");
const CATALOG_SUFFIX = "-launch-v1-catalog.ts";
const URL_REGEX = /https:\/\/[^"'\s)]+/g;
const REQUEST_TIMEOUT_MS = 15_000;
const CONCURRENCY = 6;

async function collectCatalogUrls() {
  const entries = await readdir(CATALOG_DIR);
  const catalogFiles = entries.filter((name) => name.endsWith(CATALOG_SUFFIX));
  const urls = new Set();

  for (const file of catalogFiles) {
    const contents = await readFile(path.join(CATALOG_DIR, file), "utf8");
    for (const match of contents.matchAll(URL_REGEX)) {
      // Trim a trailing comma/paren/bracket the regex may have captured.
      urls.add(match[0].replace(/[),\].]+$/, ""));
    }
  }

  return [...urls].sort();
}

async function checkUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "user-agent": "zokorp-citation-link-check/1.0",
        // Match a real browser so we only flag genuine path/host rot, not locale negotiation.
        "accept-language": "en-US,en;q=0.9",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      return { url, ok: false, reason: `redirect ${response.status} -> ${response.headers.get("location") ?? "?"}` };
    }
    if (response.status !== 200) {
      return { url, ok: false, reason: `status ${response.status}` };
    }
    return { url, ok: true };
  } catch (error) {
    return { url, ok: false, reason: `fetch failed: ${error instanceof Error ? error.message : String(error)}` };
  } finally {
    clearTimeout(timeout);
  }
}

async function run() {
  const urls = await collectCatalogUrls();
  console.log(`Checking ${urls.length} citation URLs...`);

  const results = [];
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(batch.map(checkUrl))));
  }

  const failures = results.filter((result) => !result.ok);
  for (const failure of failures) {
    console.error(`FAIL  ${failure.url}\n      ${failure.reason}`);
  }

  console.log(`\n${results.length - failures.length}/${results.length} URLs returned a clean 200.`);
  if (failures.length > 0) {
    console.error(`\n${failures.length} citation URL(s) failed verification.`);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error("Citation link check crashed:", error);
  process.exit(1);
});

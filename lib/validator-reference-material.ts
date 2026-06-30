import { SsrfBlockedError, ssrfSafeFetch } from "@/lib/ssrf-safe-fetch";
import type { ValidationTargetContext } from "@/lib/zokorp-validator-engine";

type ReferenceMaterial = {
  keywords: string[];
  notes: string[];
};

type CachedReferenceMaterial = ReferenceMaterial & {
  cachedAt: number;
};

const CACHE_MAX_AGE_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 4500;
const MAX_TEXT_CHARS = 120000;
// SEC-03: the reference destination set is code-owned cloud documentation. This allowlist is the
// PRIMARY SSRF control (the IP deny ranges in ssrf-safe-fetch are defense in depth). It covers the
// four providers the validator supports.
const ALLOWED_REFERENCE_HOST_SUFFIXES = [
  // AWS
  "aws.amazon.com",
  "docs.aws.amazon.com",
  "awsstatic.com",
  "awspartner.com",
  "amazonaws.com",
  // Azure
  "learn.microsoft.com",
  "docs.microsoft.com",
  "azure.microsoft.com",
  // GCP
  "cloud.google.com",
  "docs.cloud.google.com",
  // Snowflake
  "docs.snowflake.com",
  "snowflake.com",
];

function isReferenceHostAllowed(host: string) {
  const lower = host.toLowerCase();
  if (!lower || lower === "localhost") {
    return false;
  }
  return ALLOWED_REFERENCE_HOST_SUFFIXES.some((suffix) => lower === suffix || lower.endsWith(`.${suffix}`));
}

const cache = new Map<string, CachedReferenceMaterial>();

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "you",
  "are",
  "aws",
  "partner",
  "service",
  "services",
  "checklist",
  "validation",
  "control",
  "controls",
  "must",
  "should",
  "will",
  "have",
  "has",
  "into",
  "only",
  "than",
  "then",
  "when",
  "where",
  "also",
  "there",
  "their",
  "about",
]);

function stripHtmlTags(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywordsFromText(text: string) {
  const tokens = new Map<string, number>();

  const words = text.toLowerCase().split(/[^a-z0-9]+/);
  for (const word of words) {
    if (word.length < 4 || STOP_WORDS.has(word)) {
      continue;
    }

    tokens.set(word, (tokens.get(word) ?? 0) + 1);
  }

  return [...tokens.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 120)
    .map(([word]) => word);
}

async function fetchReferenceText(url: string): Promise<{ text: string; note?: string }> {
  try {
    // SEC-03: SSRF-safe GET — host allowlist (primary), IP deny ranges + connect-time pinning
    // (defense in depth), manual per-hop redirect revalidation, and size/time caps.
    const response = await ssrfSafeFetch(url, {
      isHostAllowed: isReferenceHostAllowed,
      timeoutMs: REQUEST_TIMEOUT_MS,
    });

    if (response.status < 200 || response.status >= 300) {
      return {
        text: "",
        note: `Reference material unavailable (${response.status}) for ${url}`,
      };
    }

    const contentType = response.contentType;

    if (contentType.includes("text/html") || contentType.includes("text/plain") || contentType.includes("application/json")) {
      const text = contentType.includes("text/html") ? stripHtmlTags(response.text) : response.text;
      return { text: text.slice(0, MAX_TEXT_CHARS) };
    }

    if (contentType.includes("application/pdf")) {
      return {
        text: "",
        note: `Reference material is PDF and was not parsed automatically: ${url}`,
      };
    }

    return {
      text: "",
      note: `Reference material format not parsed automatically (${contentType || "unknown"}): ${url}`,
    };
  } catch (error) {
    if (error instanceof SsrfBlockedError) {
      return {
        text: "",
        note: `Reference material was blocked by the SSRF safety policy for ${url}`,
      };
    }
    return {
      text: "",
      note: `Reference material could not be fetched for ${url}`,
    };
  }
}

function dedupe(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function isAllowedReferenceUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return false;
    }

    return isReferenceHostAllowed(parsed.hostname);
  } catch {
    return false;
  }
}

export async function loadTargetReferenceMaterial(target?: ValidationTargetContext): Promise<ReferenceMaterial> {
  if (!target) {
    return { keywords: [], notes: [] };
  }

  const cacheKey = target.id;
  const existing = cache.get(cacheKey);
  if (existing && Date.now() - existing.cachedAt < CACHE_MAX_AGE_MS) {
    return {
      keywords: existing.keywords,
      notes: [...existing.notes, "Reference material loaded from cache."],
    };
  }

  const notes: string[] = [];
  const keywordBuckets: string[][] = [];

  const candidateUrls = dedupe([
    target.calibrationGuideUrl ?? "",
    target.checklistUrl ?? "",
    ...(target.referenceChecklistUrls ?? []),
  ]);

  const allowedUrls = candidateUrls.filter((url) => isAllowedReferenceUrl(url));
  const blockedCount = candidateUrls.length - allowedUrls.length;
  if (blockedCount > 0) {
    notes.push(
      `${blockedCount} reference URL(s) were skipped because they were outside the allowed domain policy.`,
    );
  }

  if (allowedUrls.length === 0) {
    return {
      keywords: [],
      notes: [...notes, "No external checklist/calibration URLs were available for this target."],
    };
  }

  const fetchResults = await Promise.all(
    allowedUrls.slice(0, 2).map(async (url) => ({ url, fetched: await fetchReferenceText(url) })),
  );

  for (const entry of fetchResults) {
    const { url, fetched } = entry;
    if (fetched.note) {
      notes.push(fetched.note);
      continue;
    }

    if (!fetched.text.trim()) {
      continue;
    }

    const keywords = extractKeywordsFromText(fetched.text);
    if (keywords.length > 0) {
      keywordBuckets.push(keywords);
      notes.push(`Reference material parsed successfully from ${url}`);
    }
  }

  const merged = dedupe(keywordBuckets.flat()).slice(0, 120);

  if (merged.length === 0) {
    notes.push("No usable reference keywords were extracted from reachable material.");
  } else {
    notes.push(`Extracted ${merged.length} reference keywords from reachable checklist/calibration material.`);
  }

  cache.set(cacheKey, {
    keywords: merged,
    notes,
    cachedAt: Date.now(),
  });

  return {
    keywords: merged,
    notes,
  };
}

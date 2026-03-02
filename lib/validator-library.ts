import fs from "node:fs";
import path from "node:path";

import type {
  ValidationProfile,
  ValidationTargetContext,
  ValidationTargetOption,
} from "@/lib/zokorp-validator-engine";

type ServiceRecord = {
  source_row?: number;
  designation?: string;
  designation_id?: string;
  domain?: string;
  partner_type_path?: string;
  checklist_url?: string;
  calibration_guide_url?: string;
};

type CompetencyRecord = {
  source_row?: number;
  competency_designation?: string;
  designation_id?: string;
  domain_title?: string;
  partner_type_path?: string;
  checklist_url?: string;
  calibration_guide_url?: string;
};

const LIBRARY_ROOT = path.join(process.cwd(), "data", "validator", "library");

const STOP_WORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "this",
  "that",
  "aws",
  "partner",
  "delivery",
  "ready",
  "service",
  "services",
  "competency",
  "competencies",
]);

let cachedOptions: ValidationTargetOption[] | null = null;

const FTR_TARGETS: ValidationTargetOption[] = [
  {
    id: "ftr:service-offering",
    profile: "FTR",
    track: "ftr",
    sourceRow: 0,
    label: "Service Offering FTR",
    serviceCategory: "service",
    keywords: ["service", "offering", "foundational", "technical", "review"],
  },
  {
    id: "ftr:software-offering",
    profile: "FTR",
    track: "ftr",
    sourceRow: 0,
    label: "Software Offering FTR",
    serviceCategory: "software",
    keywords: ["software", "offering", "foundational", "technical", "review"],
  },
];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

function normalizeLink(value: string | undefined | null) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "NOT_AVAILABLE" || trimmed.toUpperCase() === "TBC") {
    return undefined;
  }

  return trimmed;
}

function buildKeywords(parts: Array<string | undefined>) {
  const tokens = new Set<string>();

  for (const part of parts) {
    if (!part) {
      continue;
    }

    for (const token of part.toLowerCase().split(/[^a-z0-9]+/)) {
      if (token.length < 3 || STOP_WORDS.has(token)) {
        continue;
      }
      tokens.add(token);
    }
  }

  return [...tokens].slice(0, 16);
}

function inferCompetencySubtype(partnerTypePath: string | undefined) {
  const lower = (partnerTypePath ?? "").toLowerCase();

  if (lower.includes("service")) {
    return "services";
  }

  if (lower.includes("software") || lower.includes("isv")) {
    return "software";
  }

  return "other";
}

function sortOptions(options: ValidationTargetOption[]) {
  const profileOrder: Record<ValidationProfile, number> = {
    FTR: 0,
    SDP: 1,
    SRP: 2,
    COMPETENCY: 3,
  };

  return options.sort((a, b) => {
    const profileDelta = profileOrder[a.profile] - profileOrder[b.profile];
    if (profileDelta !== 0) {
      return profileDelta;
    }

    return a.label.localeCompare(b.label);
  });
}

function loadOptions(): ValidationTargetOption[] {
  if (cachedOptions) {
    return cachedOptions;
  }

  const sdpIndexPath = path.join(LIBRARY_ROOT, "sdp", "index.json");
  const srpIndexPath = path.join(LIBRARY_ROOT, "srp", "index.json");
  const competencyIndexPath = path.join(LIBRARY_ROOT, "competency", "index.json");

  const sdp = safeReadJson<ServiceRecord[]>(sdpIndexPath, []);
  const srp = safeReadJson<ServiceRecord[]>(srpIndexPath, []);
  const competency = safeReadJson<CompetencyRecord[]>(competencyIndexPath, []);

  const options: ValidationTargetOption[] = [...FTR_TARGETS];

  for (const record of sdp) {
    const designation = record.designation?.trim();
    if (!designation) {
      continue;
    }

    const designationId = record.designation_id?.trim() || `row-${record.source_row ?? 0}`;

    options.push({
      id: `sdp:${slugify(designationId)}`,
      profile: "SDP",
      track: "sdp",
      sourceRow: record.source_row ?? 0,
      label: `${designation} (SDP)`,
      domain: record.domain?.trim() || undefined,
      partnerTypePath: record.partner_type_path?.trim() || undefined,
      checklistUrl: normalizeLink(record.checklist_url),
      calibrationGuideUrl: normalizeLink(record.calibration_guide_url),
      keywords: buildKeywords([designation, record.domain, record.partner_type_path, "SDP"]),
    });
  }

  for (const record of srp) {
    const designation = record.designation?.trim();
    if (!designation) {
      continue;
    }

    const designationId = record.designation_id?.trim() || `row-${record.source_row ?? 0}`;

    options.push({
      id: `srp:${slugify(designationId)}`,
      profile: "SRP",
      track: "srp",
      sourceRow: record.source_row ?? 0,
      label: `${designation} (SRP)`,
      domain: record.domain?.trim() || undefined,
      partnerTypePath: record.partner_type_path?.trim() || undefined,
      checklistUrl: normalizeLink(record.checklist_url),
      calibrationGuideUrl: normalizeLink(record.calibration_guide_url),
      keywords: buildKeywords([designation, record.domain, record.partner_type_path, "SRP"]),
    });
  }

  for (const record of competency) {
    const designation = record.competency_designation?.trim();
    if (!designation) {
      continue;
    }

    const designationId = record.designation_id?.trim() || `row-${record.source_row ?? 0}`;
    const subtype = inferCompetencySubtype(record.partner_type_path);

    options.push({
      id: `competency:${slugify(designationId)}:${subtype}`,
      profile: "COMPETENCY",
      track: "competency",
      sourceRow: record.source_row ?? 0,
      label: `${designation} (${subtype})`,
      domain: record.domain_title?.trim() || undefined,
      partnerTypePath: record.partner_type_path?.trim() || undefined,
      checklistUrl: normalizeLink(record.checklist_url),
      calibrationGuideUrl: normalizeLink(record.calibration_guide_url),
      keywords: buildKeywords([designation, record.domain_title, record.partner_type_path, subtype]),
    });
  }

  cachedOptions = sortOptions(options);
  return cachedOptions;
}

export function getValidatorTargetOptions(profile?: ValidationProfile) {
  const all = loadOptions();
  if (!profile) {
    return all;
  }

  return all.filter((option) => option.profile === profile);
}

export function resolveValidatorTargetContext(
  profile: ValidationProfile,
  targetId?: string,
): ValidationTargetContext | undefined {
  const profileOptions = getValidatorTargetOptions(profile);

  if (profileOptions.length === 0) {
    return undefined;
  }

  const selected = targetId
    ? profileOptions.find((option) => option.id === targetId)
    : profileOptions[0];

  if (!selected) {
    return undefined;
  }

  return {
    id: selected.id,
    label: selected.label,
    track: selected.track,
    domain: selected.domain,
    partnerTypePath: selected.partnerTypePath,
    serviceCategory: selected.serviceCategory,
    checklistUrl: selected.checklistUrl,
    calibrationGuideUrl: selected.calibrationGuideUrl,
    referenceChecklistUrls: selected.referenceChecklistUrls,
    keywords: selected.keywords,
  };
}

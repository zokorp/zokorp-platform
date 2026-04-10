import { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { getEmailDomain, isBusinessEmail } from "@/lib/security";

export const LEAD_SOURCES = ["account", "architecture-review"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_AUDIENCE_FILTERS = ["human", "flagged", "all"] as const;
export type LeadAudienceFilter = (typeof LEAD_AUDIENCE_FILTERS)[number];

export const LEAD_ACCOUNT_FILTERS = ["all", "linked", "lead-only"] as const;
export type LeadAccountFilter = (typeof LEAD_ACCOUNT_FILTERS)[number];

export const LEAD_VERIFIED_FILTERS = ["all", "verified", "unverified"] as const;
export type LeadVerifiedFilter = (typeof LEAD_VERIFIED_FILTERS)[number];

export const LEAD_OPS_FILTERS = ["all", "needs-attention", "healthy", "no-follow-up"] as const;
export type LeadOpsFilter = (typeof LEAD_OPS_FILTERS)[number];

export const LEAD_EXECUTION_FILTERS = ["all", "privacy", "standard"] as const;
export type LeadExecutionFilter = (typeof LEAD_EXECUTION_FILTERS)[number];

export const LEAD_SORTS = ["latest", "oldest", "submissions"] as const;
export type LeadSort = (typeof LEAD_SORTS)[number];

export type LeadDeliveryState = "unknown" | "pending" | "sent" | "failed" | "fallback";
export type LeadCrmState = "unknown" | "pending" | "synced" | "failed" | "not_configured" | "skipped";
export type LeadWorkDriveState = "unknown" | "not_requested" | "pending" | "uploaded" | "failed" | "skipped";

export type LeadDirectoryFilters = {
  q: string;
  audience: LeadAudienceFilter;
  source: LeadSource | "all";
  account: LeadAccountFilter;
  verified: LeadVerifiedFilter;
  ops: LeadOpsFilter;
  execution: LeadExecutionFilter;
  sort: LeadSort;
};

type LeadSignal =
  | "non-business-email"
  | "test-email"
  | "test-domain"
  | "test-name"
  | "test-company"
  | "automation-token"
  | "internal-domain"
  | "admin-account";

type MutableLeadDirectoryEntry = {
  email: string;
  name: string | null;
  companyName: string | null;
  hasAccount: boolean;
  emailVerified: boolean;
  isAdmin: boolean;
  isInternal: boolean;
  firstSeenAt: Date;
  latestAt: Date;
  latestSource: LeadSource;
  sources: Set<LeadSource>;
  submissionCount: number;
  emailDeliveryState: LeadDeliveryState;
  crmSyncState: LeadCrmState;
  workdriveUploadStatus: string | null;
  recommendedEngagement: string | null;
  leadStage: string | null;
  latestInteractionAction: string | null;
  latestInteractionSource: string | null;
  latestInteractionProvider: string | null;
  latestInteractionAt: Date | null;
  latestEstimateReferenceCode: string | null;
  latestServiceRequestTrackingCode: string | null;
  latestServiceRequestStatus: string | null;
  latestToolRunSummary: string | null;
  latestToolRunSlug: string | null;
  latestToolRunDeliveryStatus: string | null;
  latestToolRunExecutionMode: string | null;
  latestToolRunAt: Date | null;
  nextAction: string;
  signals: Set<LeadSignal>;
};

export type LeadDirectoryEntry = Omit<MutableLeadDirectoryEntry, "sources" | "signals"> & {
  sources: LeadSource[];
  signals: LeadSignal[];
  isLikelyHuman: boolean;
};

export type LeadDirectoryResult = {
  entries: LeadDirectoryEntry[];
  stats: {
    totalContacts: number;
    displayedContacts: number;
    likelyHumanContacts: number;
    flaggedContacts: number;
    accountHolders: number;
    verifiedAccounts: number;
    opsAttention: number;
  };
  filters: LeadDirectoryFilters;
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  account: "Account",
  "architecture-review": "Architecture Review",
};

export const LEAD_SIGNAL_LABELS: Record<LeadSignal, string> = {
  "non-business-email": "Personal/free-mail domain",
  "test-email": "Test email pattern",
  "test-domain": "Test/placeholder domain",
  "test-name": "Test/QA contact name",
  "test-company": "Placeholder company",
  "automation-token": "Automation/bot signal",
  "internal-domain": "Internal ZoKorp account",
  "admin-account": "Admin account",
};

const TEST_TOKENS = ["test", "qa", "demo", "sample", "fake", "dummy", "placeholder"];
const AUTOMATION_TOKENS = ["bot", "automation", "playwright", "cypress", "selenium", "postman"];
const INTERNAL_DOMAINS = new Set(["zokorp.com"]);

function normalizeString(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function tokenMatch(value: string, tokens: string[]) {
  return tokens.some((token) => value.includes(token));
}

function mergeDeliveryState(current: LeadDeliveryState, incoming: LeadDeliveryState): LeadDeliveryState {
  const priorities: Record<LeadDeliveryState, number> = {
    unknown: 0,
    sent: 1,
    pending: 2,
    failed: 3,
    fallback: 4,
  };

  return priorities[incoming] > priorities[current] ? incoming : current;
}

function mergeCrmState(current: LeadCrmState, incoming: LeadCrmState): LeadCrmState {
  const priorities: Record<LeadCrmState, number> = {
    unknown: 0,
    skipped: 1,
    not_configured: 2,
    synced: 3,
    pending: 4,
    failed: 5,
  };

  return priorities[incoming] > priorities[current] ? incoming : current;
}

function deriveLeadSignals(entry: {
  email: string;
  name: string | null;
  companyName: string | null;
  isInternal: boolean;
  isAdmin: boolean;
}) {
  const signals = new Set<LeadSignal>();
  const email = normalizeString(entry.email);
  const domain = normalizeString(getEmailDomain(email));
  const localPart = email.split("@")[0] ?? "";
  const name = normalizeString(entry.name);
  const company = normalizeString(entry.companyName);

  if (!isBusinessEmail(email)) {
    signals.add("non-business-email");
  }

  if (tokenMatch(localPart, TEST_TOKENS)) {
    signals.add("test-email");
  }

  if (tokenMatch(localPart, AUTOMATION_TOKENS)) {
    signals.add("automation-token");
  }

  if (tokenMatch(domain, [...TEST_TOKENS, ...AUTOMATION_TOKENS, "example", "acme"])) {
    signals.add("test-domain");
  }

  if (tokenMatch(name, [...TEST_TOKENS, ...AUTOMATION_TOKENS])) {
    signals.add(tokenMatch(name, AUTOMATION_TOKENS) ? "automation-token" : "test-name");
  }

  if (tokenMatch(company, [...TEST_TOKENS, "acme", "example", "placeholder"])) {
    signals.add("test-company");
  }

  if (entry.isInternal) {
    signals.add("internal-domain");
  }

  if (entry.isAdmin) {
    signals.add("admin-account");
  }

  return signals;
}

function deriveArchitectureDeliveryState(input: { emailSentAt: Date | null; emailDeliveryMode: string | null }) {
  if (input.emailSentAt) {
    return "sent" as const;
  }

  if (input.emailDeliveryMode === "fallback") {
    return "fallback" as const;
  }

  if (input.emailDeliveryMode === "sent") {
    return "sent" as const;
  }

  if (input.emailDeliveryMode) {
    return "pending" as const;
  }

  return "unknown" as const;
}

function deriveArchitectureCrmState(input: {
  syncedToZohoAt: Date | null;
  zohoSyncError: string | null;
  zohoSyncNeedsUpdate: boolean;
}) {
  if (input.syncedToZohoAt) {
    return "synced" as const;
  }

  if (input.zohoSyncError) {
    return "failed" as const;
  }

  if (input.zohoSyncNeedsUpdate) {
    return "pending" as const;
  }

  return "unknown" as const;
}

export function classifyWorkDriveUploadStatus(status: string | null): LeadWorkDriveState {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) {
    return "unknown";
  }

  const baseStatus = normalized.split(":", 1)[0];
  if (baseStatus === "not_requested") {
    return "not_requested";
  }

  if (baseStatus === "pending") {
    return "pending";
  }

  if (baseStatus === "uploaded" || baseStatus === "archived" || baseStatus === "legacy_raw_upload_present") {
    return "uploaded";
  }

  if (baseStatus === "failed") {
    return "failed";
  }

  if (baseStatus === "skipped") {
    return "skipped";
  }

  return "unknown";
}

export function workdriveNeedsAttention(status: string | null) {
  const state = classifyWorkDriveUploadStatus(status);
  return state === "pending" || state === "failed" || state === "skipped";
}

function mergeWorkDriveStatus(current: string | null, incoming: string | null) {
  const priorities: Record<LeadWorkDriveState, number> = {
    unknown: 0,
    not_requested: 1,
    uploaded: 2,
    pending: 3,
    skipped: 4,
    failed: 5,
  };

  return priorities[classifyWorkDriveUploadStatus(incoming)] > priorities[classifyWorkDriveUploadStatus(current)] ? incoming : current;
}

function nextActionForEntry(
  entry: Pick<
    MutableLeadDirectoryEntry,
    "signals" | "emailVerified" | "emailDeliveryState" | "crmSyncState" | "workdriveUploadStatus" | "hasAccount" | "recommendedEngagement"
  >,
) {
  if (entry.signals.has("non-business-email")) {
    return "Business-email policy flagged this contact. Qualify manually only if you intentionally want to handle a personal inbox lead.";
  }

  if (entry.signals.has("test-domain") || entry.signals.has("test-email") || entry.signals.has("automation-token")) {
    return "Ignore by default unless you are reviewing QA traffic.";
  }

  if (entry.emailDeliveryState === "failed" || entry.emailDeliveryState === "fallback") {
    return "Inspect and retry result-email delivery.";
  }

  if (entry.crmSyncState === "failed") {
    return "Retry CRM sync or inspect the Zoho error path.";
  }

  if (classifyWorkDriveUploadStatus(entry.workdriveUploadStatus) === "pending") {
    return "Monitor WorkDrive archival completion for this saved architecture review.";
  }

  if (workdriveNeedsAttention(entry.workdriveUploadStatus)) {
    return "Retry or manually follow up on the WorkDrive archive path for this saved architecture review.";
  }

  if (!entry.hasAccount) {
    return "Lead exists without an account. Follow up or wait for account creation.";
  }

  if (!entry.emailVerified) {
    return "Account exists but email is not verified yet.";
  }

  if (entry.recommendedEngagement) {
    return `Ready for follow-up on ${entry.recommendedEngagement}.`;
  }

  return "Review and follow up if this contact is sales-qualified.";
}

function isLikelyHuman(signals: Set<LeadSignal>) {
  return (
    !signals.has("non-business-email") &&
    !signals.has("test-domain") &&
    !signals.has("test-email") &&
    !signals.has("test-name") &&
    !signals.has("test-company") &&
    !signals.has("automation-token")
  );
}

function upsertLeadEntry(
  map: Map<string, MutableLeadDirectoryEntry>,
  input: {
    email: string;
    source: LeadSource;
    createdAt: Date;
    name?: string | null;
    companyName?: string | null;
    hasAccount?: boolean;
    emailVerified?: boolean;
    isAdmin?: boolean;
    emailDeliveryState?: LeadDeliveryState;
    crmSyncState?: LeadCrmState;
    workdriveUploadStatus?: string | null;
    recommendedEngagement?: string | null;
    leadStage?: string | null;
  },
) {
  const email = input.email.trim().toLowerCase();

  if (!email) {
    return;
  }

  const domain = getEmailDomain(email);
  const isInternal = Boolean(domain && INTERNAL_DOMAINS.has(domain));
  const existing = map.get(email);

  if (!existing) {
    const entry: MutableLeadDirectoryEntry = {
      email,
      name: input.name?.trim() || null,
      companyName: input.companyName?.trim() || null,
      hasAccount: Boolean(input.hasAccount),
      emailVerified: Boolean(input.emailVerified),
      isAdmin: Boolean(input.isAdmin),
      isInternal,
      firstSeenAt: input.createdAt,
      latestAt: input.createdAt,
      latestSource: input.source,
      sources: new Set([input.source]),
      submissionCount: input.source === "account" ? 0 : 1,
      emailDeliveryState: input.emailDeliveryState ?? "unknown",
      crmSyncState: input.crmSyncState ?? "unknown",
      workdriveUploadStatus: input.workdriveUploadStatus ?? null,
      recommendedEngagement: input.recommendedEngagement ?? null,
      leadStage: input.leadStage ?? null,
      latestInteractionAction: null,
      latestInteractionSource: null,
      latestInteractionProvider: null,
      latestInteractionAt: null,
      latestEstimateReferenceCode: null,
      latestServiceRequestTrackingCode: null,
      latestServiceRequestStatus: null,
      latestToolRunSummary: null,
      latestToolRunSlug: null,
      latestToolRunDeliveryStatus: null,
      latestToolRunExecutionMode: null,
      latestToolRunAt: null,
      nextAction: "",
      signals: new Set(),
    };

    entry.signals = deriveLeadSignals(entry);
    entry.nextAction = nextActionForEntry(entry);
    map.set(email, entry);
    return;
  }

  existing.sources.add(input.source);
  existing.hasAccount ||= Boolean(input.hasAccount);
  existing.emailVerified ||= Boolean(input.emailVerified);
  existing.isAdmin ||= Boolean(input.isAdmin);
  existing.isInternal ||= isInternal;
  existing.firstSeenAt = existing.firstSeenAt < input.createdAt ? existing.firstSeenAt : input.createdAt;

  if (existing.latestAt <= input.createdAt) {
    existing.latestAt = input.createdAt;
    existing.latestSource = input.source;
    existing.recommendedEngagement = input.recommendedEngagement ?? existing.recommendedEngagement;
    existing.leadStage = input.leadStage ?? existing.leadStage;
  }

  if (!existing.name && input.name?.trim()) {
    existing.name = input.name.trim();
  }

  if (!existing.companyName && input.companyName?.trim()) {
    existing.companyName = input.companyName.trim();
  }

  if (input.source !== "account") {
    existing.submissionCount += 1;
  }

  existing.emailDeliveryState = mergeDeliveryState(existing.emailDeliveryState, input.emailDeliveryState ?? "unknown");
  existing.crmSyncState = mergeCrmState(existing.crmSyncState, input.crmSyncState ?? "unknown");
  existing.workdriveUploadStatus = mergeWorkDriveStatus(existing.workdriveUploadStatus, input.workdriveUploadStatus ?? null);
  existing.signals = deriveLeadSignals(existing);
  existing.nextAction = nextActionForEntry(existing);
}

function updateLatestActivity(entry: MutableLeadDirectoryEntry, occurredAt: Date) {
  if (entry.latestAt <= occurredAt) {
    entry.latestAt = occurredAt;
  }
}

function applyLeadInteractionContext(
  entry: MutableLeadDirectoryEntry,
  input: {
    action: string;
    source: string;
    provider: string | null;
    createdAt: Date;
    estimateReferenceCode?: string | null;
    serviceRequestTrackingCode?: string | null;
    serviceRequestStatus?: string | null;
  },
) {
  if (!entry.latestInteractionAt || entry.latestInteractionAt <= input.createdAt) {
    entry.latestInteractionAction = input.action;
    entry.latestInteractionSource = input.source;
    entry.latestInteractionProvider = input.provider;
    entry.latestInteractionAt = input.createdAt;
  }

  if (!entry.latestEstimateReferenceCode && input.estimateReferenceCode) {
    entry.latestEstimateReferenceCode = input.estimateReferenceCode;
  }

  if (input.serviceRequestTrackingCode) {
    entry.latestServiceRequestTrackingCode = input.serviceRequestTrackingCode;
  }

  if (input.serviceRequestStatus) {
    entry.latestServiceRequestStatus = input.serviceRequestStatus;
  }

  updateLatestActivity(entry, input.createdAt);
}

function applyEstimateCompanionContext(
  entry: MutableLeadDirectoryEntry,
  input: {
    referenceCode: string;
    status: string;
    updatedAt: Date;
  },
) {
  if (!entry.latestEstimateReferenceCode) {
    entry.latestEstimateReferenceCode = input.referenceCode;
  }

  if (input.status === "failed") {
    entry.nextAction = "Inspect estimate companion sync and follow up on the formal estimate path.";
  }

  updateLatestActivity(entry, input.updatedAt);
}

function applyToolRunContext(
  entry: MutableLeadDirectoryEntry,
  input: {
    toolSlug: string;
    summary: string;
    deliveryStatus: string | null;
    estimateReferenceCode?: string | null;
    executionMode?: string | null;
    createdAt: Date;
  },
) {
  if (!entry.latestToolRunAt || entry.latestToolRunAt <= input.createdAt) {
    entry.latestToolRunSummary = input.summary;
    entry.latestToolRunSlug = input.toolSlug;
    entry.latestToolRunDeliveryStatus = input.deliveryStatus;
    entry.latestToolRunExecutionMode = input.executionMode ?? null;
    entry.latestToolRunAt = input.createdAt;
  }

  if (!entry.latestEstimateReferenceCode && input.estimateReferenceCode) {
    entry.latestEstimateReferenceCode = input.estimateReferenceCode;
  }

  updateLatestActivity(entry, input.createdAt);
}

function toLeadDirectoryEntry(entry: MutableLeadDirectoryEntry): LeadDirectoryEntry {
  return {
    ...entry,
    sources: [...entry.sources].sort((left, right) => LEAD_SOURCES.indexOf(left) - LEAD_SOURCES.indexOf(right)),
    signals: [...entry.signals],
    isLikelyHuman: isLikelyHuman(entry.signals),
  };
}

function normalizeValue<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T) {
  if (value && allowed.includes(value as T)) {
    return value as T;
  }

  return fallback;
}

export function normalizeLeadDirectoryFilters(input: Partial<Record<string, string | undefined>>): LeadDirectoryFilters {
  return {
    q: input.q?.trim() ?? "",
    audience: normalizeValue(input.audience, LEAD_AUDIENCE_FILTERS, "human"),
    source: normalizeValue(input.source, ["all", ...LEAD_SOURCES] as const, "all"),
    account: normalizeValue(input.account, LEAD_ACCOUNT_FILTERS, "all"),
    verified: normalizeValue(input.verified, LEAD_VERIFIED_FILTERS, "all"),
    ops: normalizeValue(input.ops, LEAD_OPS_FILTERS, "all"),
    execution: normalizeValue(input.execution, LEAD_EXECUTION_FILTERS, "all"),
    sort: normalizeValue(input.sort, LEAD_SORTS, "latest"),
  };
}

export function buildLeadDirectoryQueryString(filters: LeadDirectoryFilters) {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.audience !== "human") {
    params.set("audience", filters.audience);
  }

  if (filters.source !== "all") {
    params.set("source", filters.source);
  }

  if (filters.account !== "all") {
    params.set("account", filters.account);
  }

  if (filters.verified !== "all") {
    params.set("verified", filters.verified);
  }

  if (filters.ops !== "all") {
    params.set("ops", filters.ops);
  }

  if (filters.execution !== "all") {
    params.set("execution", filters.execution);
  }

  if (filters.sort !== "latest") {
    params.set("sort", filters.sort);
  }

  return params.toString();
}

function matchesFilters(entry: LeadDirectoryEntry, filters: LeadDirectoryFilters) {
  if (filters.audience === "human" && !entry.isLikelyHuman) {
    return false;
  }

  if (filters.audience === "flagged" && entry.isLikelyHuman) {
    return false;
  }

  if (filters.source !== "all" && !entry.sources.includes(filters.source)) {
    return false;
  }

  if (filters.account === "linked" && !entry.hasAccount) {
    return false;
  }

  if (filters.account === "lead-only" && entry.hasAccount) {
    return false;
  }

  if (filters.verified === "verified" && !entry.emailVerified) {
    return false;
  }

  if (filters.verified === "unverified" && entry.emailVerified) {
    return false;
  }

  const needsAttention =
    entry.emailDeliveryState === "failed" ||
    entry.emailDeliveryState === "fallback" ||
    entry.emailDeliveryState === "pending" ||
    entry.crmSyncState === "failed" ||
    entry.crmSyncState === "pending" ||
    workdriveNeedsAttention(entry.workdriveUploadStatus);

  const hasFollowUp =
    Boolean(entry.latestServiceRequestTrackingCode) ||
    entry.latestInteractionAction === "call_booked" ||
    entry.latestInteractionAction === "service_request_created";

  if (filters.ops === "needs-attention" && !needsAttention) {
    return false;
  }

  if (filters.ops === "healthy" && needsAttention) {
    return false;
  }

  if (filters.ops === "no-follow-up" && hasFollowUp) {
    return false;
  }

  if (
    filters.execution !== "all" &&
    entry.latestToolRunExecutionMode !== filters.execution
  ) {
    return false;
  }

  if (!filters.q) {
    return true;
  }

  const haystack = [
    entry.email,
    entry.name ?? "",
    entry.companyName ?? "",
    entry.nextAction,
    entry.recommendedEngagement ?? "",
    entry.leadStage ?? "",
    entry.latestInteractionAction ?? "",
    entry.latestInteractionSource ?? "",
    entry.latestInteractionProvider ?? "",
    entry.latestEstimateReferenceCode ?? "",
    entry.latestServiceRequestTrackingCode ?? "",
    entry.latestServiceRequestStatus ?? "",
    entry.latestToolRunSummary ?? "",
    entry.latestToolRunSlug ?? "",
    entry.latestToolRunDeliveryStatus ?? "",
    entry.latestToolRunExecutionMode ?? "",
    ...entry.sources.map((source) => LEAD_SOURCE_LABELS[source]),
    ...entry.signals.map((signal) => LEAD_SIGNAL_LABELS[signal]),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(filters.q.toLowerCase());
}

function sortEntries(entries: LeadDirectoryEntry[], sort: LeadSort) {
  return entries.sort((left, right) => {
    if (sort === "oldest") {
      return left.firstSeenAt.getTime() - right.firstSeenAt.getTime();
    }

    if (sort === "submissions") {
      if (right.submissionCount !== left.submissionCount) {
        return right.submissionCount - left.submissionCount;
      }
    }

    return right.latestAt.getTime() - left.latestAt.getTime();
  });
}

export async function getLeadDirectory(rawFilters: Partial<Record<string, string | undefined>> = {}): Promise<LeadDirectoryResult> {
  const filters = normalizeLeadDirectoryFilters(rawFilters);

  const [users, leads, architectureLeads, leadInteractions, estimateCompanions, toolRuns] = await Promise.all([
    db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        role: true,
        createdAt: true,
      },
    }),
    db.lead.findMany({
      select: {
        email: true,
        name: true,
        companyName: true,
        createdAt: true,
        lastSeenAt: true,
        userId: true,
        user: {
          select: {
            emailVerified: true,
            role: true,
            name: true,
          },
        },
        events: {
          select: {
            source: true,
            deliveryState: true,
            crmSyncState: true,
            saveForFollowUp: true,
            allowCrmFollowUp: true,
            scoreBand: true,
            estimateBand: true,
            recommendedEngagement: true,
            createdAt: true,
            sourceRecordKey: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    db.leadLog.findMany({
      select: {
        userEmail: true,
        userName: true,
        createdAt: true,
        quoteTier: true,
        leadStage: true,
        emailDeliveryMode: true,
        emailSentAt: true,
        syncedToZohoAt: true,
        zohoSyncNeedsUpdate: true,
        zohoSyncError: true,
        workdriveUploadStatus: true,
      },
    }),
    db.leadInteraction.findMany({
      select: {
        action: true,
        source: true,
        provider: true,
        estimateReferenceCode: true,
        createdAt: true,
        lead: {
          select: {
            email: true,
          },
        },
        serviceRequest: {
          select: {
            trackingCode: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    db.estimateCompanion.findMany({
      select: {
        customerEmail: true,
        referenceCode: true,
        status: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    db.toolRun.findMany({
      select: {
        toolSlug: true,
        summary: true,
        deliveryStatus: true,
        estimateReferenceCode: true,
        createdAt: true,
        metadataJson: true,
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
  ]);

  const entries = new Map<string, MutableLeadDirectoryEntry>();

  for (const user of users) {
    if (!user.email) {
      continue;
    }

    upsertLeadEntry(entries, {
      email: user.email,
      source: "account",
      createdAt: user.createdAt,
      name: user.name,
      hasAccount: true,
      emailVerified: Boolean(user.emailVerified),
      isAdmin: user.role === Role.ADMIN,
    });
  }

  for (const lead of leads) {
    const hasAccount = Boolean(lead.userId || lead.user);
    const emailVerified = Boolean(lead.user?.emailVerified);
    const isAdmin = lead.user?.role === Role.ADMIN;
    const contactName = lead.name?.trim() || lead.user?.name?.trim() || null;
    const createdAt = lead.createdAt;
    const latestAt = lead.lastSeenAt ?? lead.createdAt;

    if (lead.events.length === 0) {
      if (hasAccount) {
        upsertLeadEntry(entries, {
          email: lead.email,
          source: "account",
          createdAt,
          name: contactName,
          companyName: lead.companyName,
          hasAccount,
          emailVerified,
          isAdmin,
        });
      }

      continue;
    }

    for (const event of lead.events) {
      if (!LEAD_SOURCES.includes(event.source as LeadSource)) {
        continue;
      }

      upsertLeadEntry(entries, {
        email: lead.email,
        source: event.source as LeadSource,
        createdAt: event.createdAt ?? latestAt,
        name: contactName,
        companyName: lead.companyName,
        hasAccount,
        emailVerified,
        isAdmin,
        emailDeliveryState: (event.deliveryState as LeadDeliveryState | null) ?? "unknown",
        crmSyncState: (event.crmSyncState as LeadCrmState | null) ?? "unknown",
        recommendedEngagement: event.recommendedEngagement ?? null,
      });
    }
  }

  for (const lead of architectureLeads) {
    const email = lead.userEmail.trim().toLowerCase();

    if (!email || entries.has(email)) {
      continue;
    }

    upsertLeadEntry(entries, {
      email,
      source: "architecture-review",
      createdAt: lead.createdAt,
      name: lead.userName,
      recommendedEngagement: lead.quoteTier,
      leadStage: lead.leadStage,
      emailDeliveryState: deriveArchitectureDeliveryState({
        emailSentAt: lead.emailSentAt,
        emailDeliveryMode: lead.emailDeliveryMode,
      }),
      crmSyncState: deriveArchitectureCrmState({
        syncedToZohoAt: lead.syncedToZohoAt,
        zohoSyncError: lead.zohoSyncError,
        zohoSyncNeedsUpdate: lead.zohoSyncNeedsUpdate,
      }),
      workdriveUploadStatus: lead.workdriveUploadStatus ?? null,
    });
  }

  for (const interaction of leadInteractions) {
    const email = interaction.lead.email.trim().toLowerCase();
    const entry = entries.get(email);
    if (!entry) {
      continue;
    }

    applyLeadInteractionContext(entry, {
      action: interaction.action,
      source: interaction.source,
      provider: interaction.provider,
      createdAt: interaction.createdAt,
      estimateReferenceCode: interaction.estimateReferenceCode ?? null,
      serviceRequestTrackingCode: interaction.serviceRequest?.trackingCode ?? null,
      serviceRequestStatus: interaction.serviceRequest?.status ?? null,
    });
  }

  for (const companion of estimateCompanions) {
    const email = companion.customerEmail.trim().toLowerCase();
    const entry = entries.get(email);
    if (!entry) {
      continue;
    }

    applyEstimateCompanionContext(entry, {
      referenceCode: companion.referenceCode,
      status: companion.status,
      updatedAt: companion.updatedAt,
    });
  }

  for (const toolRun of toolRuns) {
    const email = toolRun.user?.email?.trim().toLowerCase();
    if (!email) {
      continue;
    }

    const entry = entries.get(email);
    if (!entry) {
      continue;
    }

    const metadata =
      toolRun.metadataJson && typeof toolRun.metadataJson === "object" && !Array.isArray(toolRun.metadataJson)
        ? (toolRun.metadataJson as Record<string, unknown>)
        : null;

    applyToolRunContext(entry, {
      toolSlug: toolRun.toolSlug,
      summary: toolRun.summary,
      deliveryStatus: toolRun.deliveryStatus ?? null,
      estimateReferenceCode: toolRun.estimateReferenceCode ?? null,
      executionMode:
        typeof metadata?.executionMode === "string" && metadata.executionMode.trim()
          ? metadata.executionMode.trim()
          : null,
      createdAt: toolRun.createdAt,
    });
  }

  const allEntries = [...entries.values()].map(toLeadDirectoryEntry);
  const filteredEntries = sortEntries(
    allEntries.filter((entry) => matchesFilters(entry, filters)),
    filters.sort,
  );

  return {
    entries: filteredEntries,
    stats: {
      totalContacts: allEntries.length,
      displayedContacts: filteredEntries.length,
      likelyHumanContacts: allEntries.filter((entry) => entry.isLikelyHuman).length,
      flaggedContacts: allEntries.filter((entry) => !entry.isLikelyHuman).length,
      accountHolders: allEntries.filter((entry) => entry.hasAccount).length,
      verifiedAccounts: allEntries.filter((entry) => entry.emailVerified).length,
      opsAttention: allEntries.filter(
        (entry) =>
          entry.emailDeliveryState === "failed" ||
          entry.emailDeliveryState === "fallback" ||
          entry.emailDeliveryState === "pending" ||
          entry.crmSyncState === "failed" ||
          entry.crmSyncState === "pending" ||
          workdriveNeedsAttention(entry.workdriveUploadStatus),
      ).length,
    },
    filters,
  };
}

function csvEscape(value: string | number | boolean | null) {
  if (value === null) {
    return "";
  }

  const raw = String(value);
  const neutralized =
    /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replaceAll("\"", "\"\"")}"`;
}

export function renderLeadDirectoryCsv(entries: LeadDirectoryEntry[]) {
  const header = [
    "email",
    "name",
    "company_name",
    "likely_human",
    "signals",
    "has_account",
    "email_verified",
    "is_admin",
    "is_internal",
    "sources",
    "latest_source",
    "submission_count",
    "recommended_engagement",
    "lead_stage",
    "latest_interaction_action",
    "latest_interaction_source",
    "latest_interaction_provider",
    "latest_estimate_reference_code",
    "latest_service_request_tracking_code",
    "latest_service_request_status",
    "latest_tool_run_slug",
    "latest_tool_run_delivery_status",
    "latest_tool_run_execution_mode",
    "latest_tool_run_summary",
    "email_delivery_state",
    "crm_sync_state",
    "workdrive_upload_status",
    "next_action",
    "first_seen_at",
    "latest_at",
  ];

  const rows = entries.map((entry) =>
    [
      entry.email,
      entry.name,
      entry.companyName,
      entry.isLikelyHuman,
      entry.signals.map((signal) => LEAD_SIGNAL_LABELS[signal]).join("; "),
      entry.hasAccount,
      entry.emailVerified,
      entry.isAdmin,
      entry.isInternal,
      entry.sources.map((source) => LEAD_SOURCE_LABELS[source]).join("; "),
      LEAD_SOURCE_LABELS[entry.latestSource],
      entry.submissionCount,
      entry.recommendedEngagement,
      entry.leadStage,
      entry.latestInteractionAction,
      entry.latestInteractionSource,
      entry.latestInteractionProvider,
      entry.latestEstimateReferenceCode,
      entry.latestServiceRequestTrackingCode,
      entry.latestServiceRequestStatus,
      entry.latestToolRunSlug,
      entry.latestToolRunDeliveryStatus,
      entry.latestToolRunExecutionMode,
      entry.latestToolRunSummary,
      entry.emailDeliveryState,
      entry.crmSyncState,
      entry.workdriveUploadStatus,
      entry.nextAction,
      entry.firstSeenAt.toISOString(),
      entry.latestAt.toISOString(),
    ]
      .map((value) => csvEscape(value))
      .join(","),
  );

  return [header.join(","), ...rows].join("\n");
}

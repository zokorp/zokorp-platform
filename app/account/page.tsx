import Link from "next/link";
import {
  type ArchitectureReviewJob,
  type AuditLog,
  type CreditLedgerEntry,
  CreditTier,
  EntitlementStatus,
  type EstimateCompanion,
  Role,
  ServiceRequestStatus,
  type ServiceRequest,
  type ToolRun,
} from "@prisma/client";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimelineCard } from "@/components/ui/timeline-card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import {
  SERVICE_REQUEST_STATUS_LABEL,
  SERVICE_REQUEST_STATUS_STYLE,
  SERVICE_REQUEST_TYPE_LABEL,
} from "@/lib/service-requests";
import { buildAppPageMetadata, toMarketingSiteUrl } from "@/lib/site";

import { saveAccountEmailPreferencesAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = buildAppPageMetadata({
  title: "Account",
  description: "Manage purchases, credits, service requests, tool history, and email preferences in your ZoKorp account.",
  path: "/account",
});

type TimelineBadgeVariant = "secondary" | "success" | "warning" | "danger" | "info" | "outline";

type ToolRunTimelineEntry = {
  id: string;
  createdAt: Date;
  title: string;
  badgeLabel: string;
  badgeVariant: TimelineBadgeVariant;
  summary: string;
  details: string[];
  href: string;
  hrefLabel: string;
};

type FollowUpTimelineEntry = {
  id: string;
  createdAt: Date;
  title: string;
  badgeLabel: string;
  badgeVariant: TimelineBadgeVariant;
  summary: string;
  details: string[];
};

type CreditLedgerEntryWithProduct = CreditLedgerEntry & {
  product: {
    name: string;
    slug: string;
  };
};

function isServiceRequestOpen(status: ServiceRequestStatus) {
  return status !== ServiceRequestStatus.DELIVERED && status !== ServiceRequestStatus.CLOSED;
}

function formatTierLabel(tier: CreditTier) {
  if (tier === CreditTier.SDP_SRP) {
    return "SDP/SRP";
  }

  if (tier === CreditTier.COMPETENCY) {
    return "Competency";
  }

  return tier;
}

function humanizeArchitectureJobStatus(job: Pick<ArchitectureReviewJob, "status" | "deliveryMode">) {
  if (job.status === "sent") {
    return "Delivered";
  }

  if (job.status === "fallback") {
    return "Fallback ready";
  }

  if (job.status === "rejected") {
    return "Rejected";
  }

  if (job.status === "failed") {
    return "Failed";
  }

  if (job.deliveryMode === "sent") {
    return "Delivered";
  }

  return "Processing";
}

function auditSummary(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const parts: string[] = [];

  if (typeof record.profile === "string") {
    parts.push(`Profile ${record.profile}`);
  }

  if (typeof record.score === "number") {
    parts.push(`Score ${record.score}`);
  }

  if (typeof record.filename === "string") {
    parts.push(record.filename);
  }

  if (typeof record.deliveryStatus === "string") {
    parts.push(`Email ${record.deliveryStatus}`);
  }

  if (typeof record.quoteCompanionStatus === "string") {
    parts.push(`Quote ${record.quoteCompanionStatus}`);
  }

  if (typeof record.quoteCompanionReference === "string") {
    parts.push(record.quoteCompanionReference);
  }

  if (typeof record.forecastPeriods === "number") {
    parts.push(`${record.forecastPeriods} forecast periods`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

function asRecord(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return metadata as Record<string, unknown>;
}

function readString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function architectureReviewBadgeVariant(review: Pick<ArchitectureReviewJob, "status" | "deliveryMode">): TimelineBadgeVariant {
  if (review.status === "sent" || review.deliveryMode === "sent") {
    return "success";
  }

  if (review.status === "fallback") {
    return "warning";
  }

  if (review.status === "failed" || review.status === "rejected") {
    return "danger";
  }

  return "secondary";
}

function validatorRunBadgeVariant(score: number | null, deliveryStatus: string | null): TimelineBadgeVariant {
  if (deliveryStatus === "failed") {
    return "danger";
  }

  if (score === null) {
    return "secondary";
  }

  if (score >= 90) {
    return "success";
  }

  if (score >= 60) {
    return "info";
  }

  return "warning";
}

function mlopsRunBadgeVariant(confidenceScore: number | null): TimelineBadgeVariant {
  if (confidenceScore === null) {
    return "secondary";
  }

  if (confidenceScore >= 75) {
    return "success";
  }

  if (confidenceScore >= 50) {
    return "info";
  }

  return "warning";
}

function architectureToolRunBadgeVariant(score: number | null, deliveryStatus: string | null): TimelineBadgeVariant {
  if (deliveryStatus === "fallback") {
    return "warning";
  }

  if (deliveryStatus === "failed") {
    return "danger";
  }

  if (score === null) {
    return "secondary";
  }

  if (score >= 90) {
    return "success";
  }

  if (score >= 60) {
    return "info";
  }

  return "warning";
}

function buildToolRunTimelineEntries(input: {
  architectureReviews: ArchitectureReviewJob[];
  toolRuns: ToolRun[];
  auditLogs: AuditLog[];
}) {
  const hasPersistedArchitectureRuns = input.toolRuns.some((run) => run.toolSlug === "architecture-diagram-reviewer");
  const architectureEntries: ToolRunTimelineEntry[] = hasPersistedArchitectureRuns
    ? []
    : input.architectureReviews.map((review) => ({
        id: review.id,
        createdAt: review.createdAt,
        title: "Architecture Diagram Reviewer",
        badgeLabel: humanizeArchitectureJobStatus(review),
        badgeVariant: architectureReviewBadgeVariant(review),
        summary: [
          review.overallScore !== null ? `Score ${review.overallScore}/100` : "Review in progress",
          review.analysisConfidence ? `${review.analysisConfidence} confidence` : null,
          review.quoteTier ? review.quoteTier : null,
        ]
          .filter(Boolean)
          .join(" · "),
        details: [
          review.completedAt ? `Completed ${new Date(review.completedAt).toLocaleString()}` : "Email-delivered account-linked review",
        ],
        href: "/software/architecture-diagram-reviewer",
        hrefLabel: "Open reviewer",
      }));

  const persistedToolRunEntries: ToolRunTimelineEntry[] = input.toolRuns.map((run) => {
    if (run.toolSlug === "architecture-diagram-reviewer") {
      return {
        id: run.id,
        createdAt: run.createdAt,
        title: "Architecture Diagram Reviewer",
        badgeLabel:
          run.deliveryStatus === "fallback"
            ? "Fallback"
            : run.score !== null && run.score !== undefined
              ? `Score ${run.score}/100`
              : "Completed",
        badgeVariant: architectureToolRunBadgeVariant(run.score ?? null, run.deliveryStatus ?? null),
        summary: [
          run.confidenceLabel ? `${run.confidenceLabel} confidence` : null,
          run.deliveryStatus ? `Delivery ${run.deliveryStatus}` : null,
          run.summary,
        ]
          .filter(Boolean)
          .join(" · "),
        details: [
          run.estimateAmountUsd !== null && run.estimateAmountUsd !== undefined
            ? new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(run.estimateAmountUsd)
            : null,
          run.estimateReferenceCode ? `Estimate ${run.estimateReferenceCode}` : null,
          run.estimateSla ? run.estimateSla : null,
        ].filter((value): value is string => Boolean(value)),
        href: "/software/architecture-diagram-reviewer",
        hrefLabel: "Open reviewer",
      };
    }

    if (run.toolSlug === "zokorp-validator") {
      return {
        id: run.id,
        createdAt: run.createdAt,
        title: `ZoKorpValidator · ${run.profile ?? "FTR"}`,
        badgeLabel: run.score !== null ? `${run.score}%` : "Completed",
        badgeVariant: validatorRunBadgeVariant(run.score, run.deliveryStatus ?? null),
        summary: [run.targetLabel ?? "Checklist target selected", run.deliveryStatus ? `Email ${run.deliveryStatus}` : null]
          .filter(Boolean)
          .join(" · "),
        details: [
          run.estimateAmountUsd !== null && run.estimateAmountUsd !== undefined
            ? new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(run.estimateAmountUsd)
            : null,
          run.estimateSla ? `Estimated SLA ${run.estimateSla}` : null,
          run.estimateReferenceCode ? `Formal estimate ${run.estimateReferenceCode}` : null,
        ].filter((value): value is string => Boolean(value)),
        href: "/software/zokorp-validator",
        hrefLabel: "Open validator",
      };
    }

    return {
      id: run.id,
      createdAt: run.createdAt,
      title: run.toolLabel,
      badgeLabel:
        run.confidenceScore !== null && run.confidenceScore !== undefined
          ? `Confidence ${run.confidenceScore}%`
          : "Completed",
      badgeVariant: mlopsRunBadgeVariant(run.confidenceScore ?? null),
      summary: [run.sourceName ?? run.summary, run.sourceType ? run.sourceType.toUpperCase() : null]
        .filter(Boolean)
        .join(" · "),
      details: [run.confidenceLabel ? `${run.confidenceLabel} confidence` : null].filter(
        (value): value is string => Boolean(value),
      ),
      href: "/software/mlops-foundation-platform",
      hrefLabel: "Open forecasting beta",
    };
  });

  if (persistedToolRunEntries.length > 0) {
    return [...architectureEntries, ...persistedToolRunEntries].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );
  }

  const auditEntries: ToolRunTimelineEntry[] = input.auditLogs.flatMap((log) => {
    const metadata = asRecord(log.metadataJson);

    if (log.action === "tool.zokorp_validator_run") {
      const profile = readString(metadata, "profile") ?? "FTR";
      const score = readNumber(metadata, "score");
      const deliveryStatus = readString(metadata, "deliveryStatus");
      const estimateQuoteUsd = readNumber(metadata, "estimateQuoteUsd");
      const estimateSla = readString(metadata, "estimateSla");
      const targetLabel = readString(metadata, "targetLabel");
      const quoteReference = readString(metadata, "quoteCompanionReference");

      return [
        {
          id: log.id,
          createdAt: log.createdAt,
          title: `ZoKorpValidator · ${profile}`,
          badgeLabel: score !== null ? `${score}%` : "Completed",
          badgeVariant: validatorRunBadgeVariant(score, deliveryStatus),
          summary: [
            targetLabel ?? "Checklist target selected",
            deliveryStatus ? `Email ${deliveryStatus}` : null,
            estimateQuoteUsd !== null
              ? new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 0,
                }).format(estimateQuoteUsd)
              : null,
          ]
            .filter(Boolean)
            .join(" · "),
          details: [estimateSla ? `Estimated SLA ${estimateSla}` : null, quoteReference ? `Formal estimate ${quoteReference}` : null].filter(
            (value): value is string => Boolean(value),
          ),
          href: "/software/zokorp-validator",
          hrefLabel: "Open validator",
        },
      ];
    }

    if (log.action === "tool.mlops_forecast_run") {
      const metadata = asRecord(log.metadataJson);
      const confidenceScore = readNumber(metadata, "confidenceScore");
      const sourceName = readString(metadata, "sourceName");
      const sourceType = readString(metadata, "sourceType");
      const cadenceLabel = readString(metadata, "cadenceLabel");
      const demoRun = metadata?.demoRun === true;

      return [
        {
          id: log.id,
          createdAt: log.createdAt,
          title: "ZoKorp MLOps Forecasting Beta",
          badgeLabel: confidenceScore !== null ? `Confidence ${confidenceScore}%` : "Completed",
          badgeVariant: mlopsRunBadgeVariant(confidenceScore),
          summary: [sourceName ?? "Forecast input", sourceType ? sourceType.toUpperCase() : null, demoRun ? "Demo run" : "Customer run"]
            .filter(Boolean)
            .join(" · "),
          details: [cadenceLabel ? `Cadence ${cadenceLabel}` : null].filter((value): value is string => Boolean(value)),
          href: "/software/mlops-foundation-platform",
          hrefLabel: "Open MLOps beta",
        },
      ];
    }

    return [];
  });

  return [...architectureEntries, ...auditEntries].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

function creditLedgerReasonLabel(reason: CreditLedgerEntry["reason"]) {
  switch (reason) {
    case "PURCHASE":
      return "Purchase";
    case "CONSUMPTION":
      return "Consumption";
    case "MANUAL_ADJUSTMENT":
      return "Manual adjustment";
    case "REFUND":
      return "Refund";
    case "REVERSAL":
      return "Reversal";
    default:
      return reason;
  }
}

function creditLedgerBadgeVariant(reason: CreditLedgerEntry["reason"], delta: number): TimelineBadgeVariant {
  if (reason === "PURCHASE") {
    return "success";
  }

  if (reason === "CONSUMPTION") {
    return "info";
  }

  if (reason === "REFUND" || reason === "REVERSAL") {
    return "warning";
  }

  if (delta > 0) {
    return "success";
  }

  if (delta < 0) {
    return "warning";
  }

  return "secondary";
}

function formatCreditDelta(delta: number) {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function buildFollowUpTimelineEntries(
  leadInteractions: Array<{
    id: string;
    createdAt: Date;
    source: string;
    action: string;
    provider: string | null;
    estimateReferenceCode: string | null;
    serviceRequest: { trackingCode: string; status: ServiceRequestStatus } | null;
  }>,
): FollowUpTimelineEntry[] {
  return leadInteractions.map((interaction) => ({
    id: interaction.id,
    createdAt: interaction.createdAt,
    title:
      interaction.action === "call_booked"
        ? "Architecture follow-up booked"
        : interaction.action === "cta_clicked"
          ? "Architecture follow-up link opened"
          : interaction.action === "delivery_requested"
            ? "Result email requested"
            : interaction.action === "delivery_sent"
              ? "Result email sent"
              : interaction.action === "delivery_fallback"
                ? "Result email fallback prepared"
                : interaction.action === "service_request_created"
                  ? "Service request created"
                  : "Architecture follow-up signal",
    badgeLabel:
      interaction.serviceRequest
        ? interaction.serviceRequest.status
        : interaction.action === "delivery_fallback"
          ? "Fallback"
          : interaction.action === "delivery_sent"
            ? "Sent"
            : interaction.action === "delivery_requested"
              ? "Queued"
              : "Recorded",
    badgeVariant:
      interaction.serviceRequest
        ? "success"
        : interaction.action === "delivery_fallback"
          ? "warning"
          : interaction.action === "delivery_sent"
            ? "success"
            : "info",
    summary: [
      interaction.provider ?? "provider unknown",
      interaction.source,
      interaction.estimateReferenceCode ? `Estimate ${interaction.estimateReferenceCode}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    details: [
      interaction.serviceRequest?.trackingCode ? `Linked service request ${interaction.serviceRequest.trackingCode}` : "No linked service request yet",
      `Recorded ${new Date(interaction.createdAt).toLocaleString()}`,
    ],
  }));
}

export default async function AccountPage() {
  const session = await auth();
  const email = session?.user?.email;
  const isAdminAccount = session?.user?.role === Role.ADMIN;

  if (!email) {
    redirect("/login?callbackUrl=/account");
  }

  let user = null;
  let serviceRequests: ServiceRequest[] = [];
  let estimateCompanions: EstimateCompanion[] = [];
  let accountLoadError = false;

  try {
    user = await db.user.findUnique({
      where: { email },
      include: {
        entitlements: {
          include: {
            product: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        creditBalances: {
          include: {
            product: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
        },
        checkoutFulfillments: {
          include: {
            product: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 40,
        },
        architectureReviewJobs: {
          orderBy: { createdAt: "desc" },
          take: 12,
        },
        toolRuns: {
          orderBy: {
            createdAt: "desc",
          },
          take: 24,
        },
        creditLedgerEntries: {
          include: {
            product: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 40,
        },
        leadInteractions: {
          where: {
            action: {
              in: [
                "call_booked",
                "cta_clicked",
                "delivery_requested",
                "delivery_sent",
                "delivery_fallback",
                "service_request_created",
              ],
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
          include: {
            serviceRequest: {
              select: {
                trackingCode: true,
                status: true,
              },
            },
          },
        },
        emailPreference: true,
      },
    });

    if (user) {
      try {
        serviceRequests = await db.serviceRequest.findMany({
          where: {
            OR: [
              { userId: user.id },
              { requesterEmail: email.toLowerCase() },
            ],
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 25,
        });
      } catch (error) {
        if (!isSchemaDriftError(error)) {
          throw error;
        }
      }

      try {
        estimateCompanions = await db.estimateCompanion.findMany({
          where: {
            OR: [
              { userId: user.id },
              ...(user.email ? [{ customerEmail: user.email }] : []),
            ],
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        });
      } catch (error) {
        if (!isSchemaDriftError(error)) {
          throw error;
        }
      }
    }
  } catch (error) {
    console.error("Failed to load account page data.", { email, error });
    accountLoadError = true;
  }

  if (accountLoadError) {
    return (
      <div className="space-y-6">
        <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
          <CardHeader>
            <h1 className="font-display text-3xl font-semibold text-slate-900">Account</h1>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              We could not load your account right now due to a backend error. Please try again in a few minutes.
            </p>
            <Link href="/software" className={buttonVariants()}>
              Return to Software
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
          <CardHeader>
            <h1 className="font-display text-3xl font-semibold text-slate-900">Account</h1>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-slate-600">
              We could not load your account data yet. This usually means database settings are still
              being finalized in the deployment environment.
            </p>
            <Link href="/software" className={buttonVariants()}>
              Return to Software
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeSubscriptions = user.entitlements.filter(
    (entitlement) =>
      (entitlement.product.accessModel === "SUBSCRIPTION" || entitlement.product.accessModel === "METERED") &&
      entitlement.status === EntitlementStatus.ACTIVE,
  );
  const activeCredits = user.creditBalances.filter((wallet) => wallet.status === EntitlementStatus.ACTIVE);
  const openServiceRequests = serviceRequests.filter((request) => isServiceRequestOpen(request.status));
  const architectureReviews = user.architectureReviewJobs;
  const toolRunEntries = buildToolRunTimelineEntries({
    architectureReviews,
    toolRuns: user.toolRuns,
    auditLogs: user.auditLogs,
  });
  const followUpEntries = buildFollowUpTimelineEntries(user.leadInteractions);
  const creditLedgerEntries = user.creditLedgerEntries as CreditLedgerEntryWithProduct[];
  const emailPreferences = {
    operationalResultEmails: user.emailPreference?.operationalResultEmails ?? true,
    marketingFollowUpEmails: user.emailPreference?.marketingFollowUpEmails ?? false,
    updatedAt: user.emailPreference?.updatedAt ?? null,
  };

  return (
    <div className="space-y-6">
      <Card tone="glass" className="animate-fade-up rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Account Hub</p>
              <h1 className="font-display mt-1 text-4xl font-semibold text-slate-900">Welcome back</h1>
              <p className="mt-2 text-sm text-slate-600">Signed in as {user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isAdminAccount ? <Badge variant="brand">Admin workspace active</Badge> : null}
              <Badge variant="secondary">{openServiceRequests.length} open requests</Badge>
              <Badge variant="secondary">{activeSubscriptions.length} active subscriptions</Badge>
              <Badge variant="secondary">{activeCredits.length} active credit wallets</Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {isAdminAccount ? (
              <Link href="/admin/leads" className={buttonVariants({ variant: "secondary" })}>
                Admin leads
              </Link>
            ) : null}
            {isAdminAccount ? (
              <Link href="/admin/readiness" className={buttonVariants({ variant: "secondary" })}>
                Runtime readiness
              </Link>
            ) : null}
            {isAdminAccount ? (
              <Link href="/admin/billing" className={buttonVariants({ variant: "secondary" })}>
                Admin billing
              </Link>
            ) : null}
            {isAdminAccount ? (
              <Link href="/admin/operations" className={buttonVariants({ variant: "secondary" })}>
                Admin operations
              </Link>
            ) : null}
            {isAdminAccount ? (
              <Link href="/admin/billing" className={buttonVariants({ variant: "secondary" })}>
                Admin billing
              </Link>
            ) : null}
            {isAdminAccount ? (
              <Link href="/admin/service-requests" className={buttonVariants({ variant: "secondary" })}>
                Admin queue
              </Link>
            ) : null}
            <Link href="/account/billing" className={buttonVariants()}>
              Billing and Invoices
            </Link>
            <Link href={toMarketingSiteUrl("/services#service-request")} className={buttonVariants({ variant: "secondary" })}>
              New Service Request
            </Link>
          </div>
        </CardHeader>
      </Card>

      {isAdminAccount ? (
        <Card tone="muted" className="rounded-[calc(var(--radius-xl)+0.25rem)] p-5">
          <CardContent className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Admin testing</p>
            <p className="text-sm leading-6 text-slate-600">
              This verified allowlisted account has admin-only workspace access and server-side paid-tool testing overrides where supported.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Open Requests", value: openServiceRequests.length },
          { label: "Active Subscriptions", value: activeSubscriptions.length },
          { label: "Credit Wallets", value: activeCredits.length },
          { label: "Credit Activity", value: creditLedgerEntries.length },
          { label: "Recent Purchases", value: user.checkoutFulfillments.length },
          { label: "Formal Estimates", value: estimateCompanions.length },
          { label: "Tool Runs", value: toolRunEntries.length },
        ].map((item) => (
          <Card key={item.label} lift className="rounded-3xl p-4">
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
            </CardHeader>
            <CardContent>
              <p className="font-display text-3xl font-semibold text-slate-900">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-[calc(var(--radius-xl)+0.25rem)] p-6">
        <CardHeader className="gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</p>
            <h2 className="font-display text-3xl font-semibold text-slate-900">Account activity and access</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Service delivery stays first, with credits, entitlements, purchases, and activity close behind in one account view.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="service-requests" className="space-y-5">
            <TabsList className="w-full justify-start" aria-label="Account sections">
              <TabsTrigger value="service-requests">Service Requests</TabsTrigger>
              <TabsTrigger value="follow-ups">Follow-ups</TabsTrigger>
              <TabsTrigger value="credits">Credits</TabsTrigger>
              <TabsTrigger value="credit-activity">Credit Activity</TabsTrigger>
              <TabsTrigger value="entitlements">Entitlements</TabsTrigger>
              <TabsTrigger value="purchases">Purchases</TabsTrigger>
              <TabsTrigger value="estimates">Estimates</TabsTrigger>
              <TabsTrigger value="tool-runs">Tool Runs</TabsTrigger>
              <TabsTrigger value="email-preferences">Email Preferences</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="service-requests" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  Track customer-visible request status, delivery notes, and preferred timing in one timeline. Requests submitted before account creation also appear here when they match this business email.
                </p>
                <Link href={toMarketingSiteUrl("/services#service-request")} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Submit another request
                </Link>
              </div>

              {serviceRequests.length === 0 ? (
                <Card tone="muted" className="rounded-3xl p-5">
                  <CardContent>
                    <p className="text-sm text-slate-600">No service requests yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {serviceRequests.map((request) => (
                    <TimelineCard
                      key={request.id}
                      title={request.title}
                      meta={`${request.trackingCode} · ${SERVICE_REQUEST_TYPE_LABEL[request.type]} · Submitted ${new Date(request.createdAt).toLocaleDateString("en-US")}`}
                      badge={
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${SERVICE_REQUEST_STATUS_STYLE[request.status]}`}
                        >
                          {SERVICE_REQUEST_STATUS_LABEL[request.status]}
                        </span>
                      }
                      summary={request.summary}
                      details={
                        <>
                          {request.preferredStart ? (
                            <span>Preferred start: {new Date(request.preferredStart).toLocaleDateString("en-US")}</span>
                          ) : null}
                          {request.budgetRange ? <span>Budget: {request.budgetRange}</span> : null}
                          <span>
                            Source: {request.requesterSource === "account" ? "Account form" : "Public request form"}
                          </span>
                          {request.requesterEmail !== user.email ? <span>Requester email: {request.requesterEmail}</span> : null}
                        </>
                      }
                      footer={
                        request.latestNote ? (
                          <div className="rounded-xl border border-border bg-white px-3 py-2 text-xs text-slate-700">
                            Latest update: {request.latestNote}
                          </div>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="follow-ups" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  Review booked-call signals and estimate-linked follow-up events tied back into your account.
                </p>
                <Link href={toMarketingSiteUrl("/services")} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Return to services
                </Link>
              </div>

              {followUpEntries.length === 0 ? (
                <Card tone="muted" className="rounded-3xl p-5">
                  <CardContent>
                    <p className="text-sm text-slate-600">No booked follow-up events recorded yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {followUpEntries.map((entry) => (
                    <TimelineCard
                      key={entry.id}
                      title={entry.title}
                      meta={entry.createdAt.toLocaleString()}
                      badge={<Badge variant={entry.badgeVariant}>{entry.badgeLabel}</Badge>}
                      summary={entry.summary}
                      details={
                        <>
                          {entry.details.map((detail) => (
                            <span key={detail}>{detail}</span>
                          ))}
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="credits" className="space-y-4">
              <p className="text-sm text-slate-600">
                Credit wallets show how many validator or product-specific uses are currently available. For an immutable purchase-and-consumption timeline, use the credit activity tab.
              </p>
              {user.creditBalances.length === 0 ? (
                <Card tone="muted" className="rounded-3xl p-5">
                  <CardContent>
                    <p className="text-sm text-slate-600">No credit wallets found yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {user.creditBalances.map((wallet) => (
                    <Card key={wallet.id} className="rounded-3xl p-5">
                      <CardHeader>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Credit wallet</p>
                        <h3 className="font-display text-2xl font-semibold text-slate-900">
                          {wallet.product.name} · {formatTierLabel(wallet.tier)}
                        </h3>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-slate-600">
                        <p>Remaining uses: {wallet.remainingUses}</p>
                        <p>Status: {wallet.status}</p>
                        <p>Last updated: {wallet.updatedAt.toLocaleString()}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="credit-activity" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  Immutable credit ledger entries show every credit purchase and every validator consumption event recorded against this account.
                </p>
                <Link href="/account/billing" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Open billing portal
                </Link>
              </div>

              {creditLedgerEntries.length === 0 ? (
                <Card tone="muted" className="rounded-3xl p-5">
                  <CardContent>
                    <p className="text-sm text-slate-600">No credit purchase or consumption activity has been recorded yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {creditLedgerEntries.map((entry) => (
                    <TimelineCard
                      key={entry.id}
                      title={`${entry.product.name} · ${formatTierLabel(entry.tier)}`}
                      meta={new Date(entry.createdAt).toLocaleString()}
                      badge={<Badge variant={creditLedgerBadgeVariant(entry.reason, entry.delta)}>{creditLedgerReasonLabel(entry.reason)}</Badge>}
                      summary={[
                        `${formatCreditDelta(entry.delta)} use${Math.abs(entry.delta) === 1 ? "" : "s"}`,
                        `Balance after ${entry.balanceAfter}`,
                        entry.sourceRecordKey ? `Ref ${entry.sourceRecordKey}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      details={
                        <>
                          <span>Recorded source: {entry.source}</span>
                          <span>Tier: {formatTierLabel(entry.tier)}</span>
                        </>
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="entitlements" className="space-y-4">
              {user.entitlements.length === 0 ? (
                <Card tone="muted" className="rounded-3xl p-5">
                  <CardContent>
                    <p className="text-sm text-slate-600">No active entitlements yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {user.entitlements.map((entitlement) => (
                    <Card key={entitlement.id} className="rounded-3xl p-5">
                      <CardHeader>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Entitlement</p>
                        <h3 className="font-display text-2xl font-semibold text-slate-900">{entitlement.product.name}</h3>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-slate-600">
                        <p>Status: {entitlement.status}</p>
                        <p>Remaining uses: {entitlement.remainingUses}</p>
                        {entitlement.validUntil ? (
                          <p>Valid until: {entitlement.validUntil.toLocaleDateString("en-US")}</p>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="purchases" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  Completed software purchases are listed here. Use the Stripe-hosted billing portal for invoices, receipts, payment methods, and subscription changes.
                </p>
                <Link href="/account/billing" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                  Open billing portal
                </Link>
              </div>
              {user.checkoutFulfillments.length === 0 ? (
                <Card tone="muted" className="rounded-3xl p-5">
                  <CardContent>
                    <p className="text-sm text-slate-600">No completed checkouts yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {user.checkoutFulfillments.map((purchase) => (
                    <TimelineCard
                      key={purchase.id}
                      title={purchase.product.name}
                      meta={new Date(purchase.createdAt).toLocaleString()}
                      badge={<Badge variant="secondary">Fulfilled</Badge>}
                      summary={
                        <>
                          Checkout session: <span className="font-mono">{purchase.stripeCheckoutSessionId}</span>
                        </>
                      }
                      footer={
                        <Link href={`/software/${purchase.product.slug}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                          Open tool
                        </Link>
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="estimates" className="space-y-4">
              {estimateCompanions.length === 0 ? (
                <Card tone="muted" className="rounded-3xl p-5">
                  <CardContent>
                    <p className="text-sm text-slate-600">No formal consultation or remediation estimates have been recorded yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {estimateCompanions.map((estimate) => (
                    <TimelineCard
                      key={estimate.id}
                      title={estimate.sourceLabel}
                      meta={new Date(estimate.createdAt).toLocaleString()}
                      badge={<Badge variant={estimate.status === "created" ? "success" : estimate.status === "failed" ? "danger" : "secondary"}>{estimate.status}</Badge>}
                      summary={
                        <>
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: estimate.currency.toUpperCase(),
                            maximumFractionDigits: 0,
                          }).format(estimate.amountUsd)}
                          {estimate.provider ? ` · ${estimate.provider}` : ""}
                          {estimate.externalNumber ? ` · ${estimate.externalNumber}` : ""}
                        </>
                      }
                      details={
                        <>
                          <span>Reference: {estimate.referenceCode}</span>
                          <span>Customer email: {estimate.customerEmail}</span>
                        </>
                      }
                      footer={
                        estimate.externalUrl ? (
                          <Link href={estimate.externalUrl} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                            Open formal estimate
                          </Link>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="tool-runs" className="space-y-4">
              {toolRunEntries.length === 0 ? (
                <Card tone="muted" className="rounded-3xl p-5">
                  <CardContent>
                    <p className="text-sm text-slate-600">No architecture, validator, or forecasting runs have been recorded on this account yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {toolRunEntries.map((entry) => (
                    <TimelineCard
                      key={entry.id}
                      title={entry.title}
                      meta={new Date(entry.createdAt).toLocaleString()}
                      badge={<Badge variant={entry.badgeVariant}>{entry.badgeLabel}</Badge>}
                      summary={entry.summary}
                      details={
                        entry.details.length > 0 ? (
                          <>
                            {entry.details.map((detail) => (
                              <span key={detail}>{detail}</span>
                            ))}
                          </>
                        ) : undefined
                      }
                      footer={
                        <Link
                          href={entry.href}
                          className={buttonVariants({ variant: "secondary", size: "sm" })}
                        >
                          {entry.hrefLabel}
                        </Link>
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="email-preferences" className="space-y-4">
              <Card className="rounded-3xl p-5">
                <CardHeader className="gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Email controls</p>
                  <h3 className="font-display text-2xl font-semibold text-slate-900">Operational delivery and future follow-up</h3>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-6 text-slate-600">
                    Keep result-delivery emails separate from future outreach. Marketing follow-up stays off by default until you explicitly enable it.
                  </p>

                  <form action={saveAccountEmailPreferencesAction} className="space-y-4">
                    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <input
                        type="checkbox"
                        name="operationalResultEmails"
                        defaultChecked={emailPreferences.operationalResultEmails}
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />
                      <span className="space-y-1">
                        <span className="block text-sm font-semibold text-slate-900">Operational result emails</span>
                        <span className="block text-sm leading-6 text-slate-600">
                          Requested tool results, billing-critical notices, and account-linked workflow updates.
                        </span>
                      </span>
                    </label>

                    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <input
                        type="checkbox"
                        name="marketingFollowUpEmails"
                        defaultChecked={emailPreferences.marketingFollowUpEmails}
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />
                      <span className="space-y-1">
                        <span className="block text-sm font-semibold text-slate-900">Future marketing follow-up</span>
                        <span className="block text-sm leading-6 text-slate-600">
                          Optional launch announcements, product updates, and advisory follow-up that is not required to operate your account.
                        </span>
                      </span>
                    </label>

                    <div className="flex flex-wrap items-center gap-3">
                      <button type="submit" className={buttonVariants()}>
                        Save preferences
                      </button>
                      <Link href={toMarketingSiteUrl("/support")} className={buttonVariants({ variant: "secondary" })}>
                        Contact support
                      </Link>
                    </div>
                  </form>

                  <p className="text-xs text-slate-500">
                    {emailPreferences.updatedAt
                      ? `Last updated ${emailPreferences.updatedAt.toLocaleString()}`
                      : "No manual preference changes have been recorded yet."}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              {user.auditLogs.length === 0 ? (
                <Card tone="muted" className="rounded-3xl p-5">
                  <CardContent>
                    <p className="text-sm text-slate-600">No activity logged yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {user.auditLogs.map((log) => (
                    <TimelineCard
                      key={log.id}
                      title={log.action}
                      meta={new Date(log.createdAt).toLocaleString()}
                      badge={<Badge variant="outline">Audit</Badge>}
                      summary={auditSummary(log.metadataJson)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

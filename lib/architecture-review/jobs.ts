import { Prisma, type ArchitectureReviewJob } from "@prisma/client";

import { buildReviewReportFromEvidence } from "@/lib/architecture-review/client";
import { buildArchitectureReviewCtaLinks } from "@/lib/architecture-review/cta-links";
import { buildArchitectureReviewEmailContent, buildMailtoUrl } from "@/lib/architecture-review/email";
import { createEmlToken } from "@/lib/architecture-review/eml-token";
import { detectNonArchitectureEvidence } from "@/lib/architecture-review/engine";
import { createEvidenceBundle } from "@/lib/architecture-review/evidence";
import { calculateLeadScore } from "@/lib/architecture-review/lead";
import { summarizeTopIssues } from "@/lib/architecture-review/report";
import { sendArchitectureReviewEmail } from "@/lib/architecture-review/sender";
import { extractSvgEvidenceFromBytes } from "@/lib/architecture-review/server";
import {
  architectureReviewMetadataSchema,
  submitArchitectureReviewMetadataSchema,
  type ArchitectureReviewPhase,
  type SubmitArchitectureReviewMetadata,
} from "@/lib/architecture-review/types";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import { ensureLeadLogSchemaReady } from "@/lib/lead-log-schema";
import { archiveArchitectureReviewToWorkDrive } from "@/lib/zoho-workdrive";

const PROCESSING_PHASES: ArchitectureReviewPhase[] = [
  "upload-validate",
  "diagram-precheck",
  "ocr",
  "rules",
  "package-email",
  "send-fallback",
  "completed",
];

type DeviceClass = "mobile" | "tablet" | "desktop" | "unknown";
type TimedArchitectureReviewPhase = Exclude<ArchitectureReviewPhase, "completed" | "llm-refine">;

const PHASE_BASELINE_MS: Record<DeviceClass, Record<TimedArchitectureReviewPhase, number>> = {
  desktop: {
    "upload-validate": 1400,
    "diagram-precheck": 2000,
    ocr: 24000,
    rules: 3000,
    "package-email": 2600,
    "send-fallback": 3500,
  },
  tablet: {
    "upload-validate": 1700,
    "diagram-precheck": 2200,
    ocr: 28000,
    rules: 3200,
    "package-email": 2800,
    "send-fallback": 3800,
  },
  mobile: {
    "upload-validate": 1900,
    "diagram-precheck": 2600,
    ocr: 34000,
    rules: 3600,
    "package-email": 3200,
    "send-fallback": 4200,
  },
  unknown: {
    "upload-validate": 1700,
    "diagram-precheck": 2400,
    ocr: 28000,
    rules: 3300,
    "package-email": 2800,
    "send-fallback": 3900,
  },
};

const NON_ARCH_PARAGRAPH_TERMS = [
  "tradeline",
  "credit score",
  "account number",
  "statement",
  "debt",
  "utilization",
  "payment due",
  "invoice",
  "apr",
  "loan",
  "balance",
];

const ARCH_PARAGRAPH_TERMS = [
  "api",
  "service",
  "database",
  "load balancer",
  "gateway",
  "queue",
  "cache",
  "ingress",
  "egress",
  "vpc",
  "subnet",
  "kubernetes",
  "monitoring",
  "architecture",
  "diagram",
];

type JobStatus = "queued" | "running" | "sent" | "fallback" | "rejected" | "failed";

type JobPhaseTiming = {
  startedAtISO?: string;
  completedAtISO?: string;
  durationMs?: number;
};

type JobPhaseTimings = Partial<Record<ArchitectureReviewPhase, JobPhaseTiming>>;

const LEASE_STALE_MS = 75_000;
const MAX_ATTEMPTS = 3;

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toNullableJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return toInputJsonValue(value);
}

function phaseIndex(phase: ArchitectureReviewPhase | null | undefined) {
  if (!phase) {
    return 0;
  }

  const index = PROCESSING_PHASES.indexOf(phase);
  return index < 0 ? 0 : index;
}

function timedPhases() {
  return PROCESSING_PHASES.filter(
    (phase): phase is TimedArchitectureReviewPhase => phase !== "completed" && phase !== "llm-refine",
  );
}

function emlSecret() {
  return process.env.ARCH_REVIEW_EML_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

function parseDeviceClass(value: unknown): DeviceClass {
  if (value === "mobile" || value === "tablet" || value === "desktop") {
    return value;
  }

  return "unknown";
}

function parsePhaseTimings(input: Prisma.JsonValue | null | undefined): JobPhaseTimings {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const output: JobPhaseTimings = {};
  for (const [phase, value] of Object.entries(input)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }

    output[phase as ArchitectureReviewPhase] = {
      startedAtISO:
        typeof (value as { startedAtISO?: unknown }).startedAtISO === "string"
          ? (value as { startedAtISO?: string }).startedAtISO
          : undefined,
      completedAtISO:
        typeof (value as { completedAtISO?: unknown }).completedAtISO === "string"
          ? (value as { completedAtISO?: string }).completedAtISO
          : undefined,
      durationMs:
        typeof (value as { durationMs?: unknown }).durationMs === "number"
          ? Math.max(0, Math.round((value as { durationMs?: number }).durationMs ?? 0))
          : undefined,
    };
  }

  return output;
}

function markPhaseStart(timings: JobPhaseTimings, phase: ArchitectureReviewPhase, nowIso: string) {
  const current = timings[phase] ?? {};
  return {
    ...timings,
    [phase]: {
      ...current,
      startedAtISO: current.startedAtISO ?? nowIso,
    },
  } as JobPhaseTimings;
}

function markPhaseComplete(timings: JobPhaseTimings, phase: ArchitectureReviewPhase, nowIso: string) {
  const current = timings[phase] ?? {};
  const startedAtISO = current.startedAtISO ?? nowIso;
  const durationMs = Math.max(0, new Date(nowIso).getTime() - new Date(startedAtISO).getTime());

  return {
    ...timings,
    [phase]: {
      ...current,
      startedAtISO,
      completedAtISO: nowIso,
      durationMs,
    },
  } as JobPhaseTimings;
}

function estimateEtaSeconds(input: {
  deviceClass: DeviceClass;
  currentPhase: ArchitectureReviewPhase;
  timings: JobPhaseTimings;
  nowMs: number;
}) {
  const baseline = PHASE_BASELINE_MS[input.deviceClass];
  const currentIndex = phaseIndex(input.currentPhase);
  const activePhases = timedPhases();

  const observedRatios: number[] = [];
  for (const phase of activePhases) {
    const timing = input.timings[phase];
    if (!timing?.durationMs || !timing.completedAtISO) {
      continue;
    }

    const expected = baseline[phase] ?? 1;
    observedRatios.push(Math.max(0.3, Math.min(2.5, timing.durationMs / expected)));
  }

  const ratio = observedRatios.length > 0 ? observedRatios.reduce((sum, value) => sum + value, 0) / observedRatios.length : 1;

  const currentTiming = input.timings[input.currentPhase];
  const currentExpected =
    input.currentPhase === "completed" || input.currentPhase === "llm-refine"
      ? 0
      : baseline[input.currentPhase] ?? 0;

  const currentElapsed = currentTiming?.startedAtISO ? Math.max(0, input.nowMs - new Date(currentTiming.startedAtISO).getTime()) : 0;
  const currentRemaining = Math.max(0, currentExpected * ratio - currentElapsed);

  const remainingTail = activePhases
    .slice(Math.min(activePhases.length, currentIndex + 1))
    .reduce((sum, phase) => sum + baseline[phase] * ratio, 0);

  return Math.max(0, Math.round((currentRemaining + remainingTail) / 1000));
}

function estimateProgressPct(input: {
  currentPhase: ArchitectureReviewPhase;
  timings: JobPhaseTimings;
  deviceClass: DeviceClass;
  nowMs: number;
}) {
  const activePhases = timedPhases();

  if (input.currentPhase === "completed") {
    return 100;
  }

  const completedCount = activePhases.filter((phase) => input.timings[phase]?.completedAtISO).length;
  const phase = input.currentPhase;
  const baseline = phase === "llm-refine" ? 1 : (PHASE_BASELINE_MS[input.deviceClass][phase] ?? 1);
  const startedAt = input.timings[phase]?.startedAtISO;
  const elapsed = startedAt ? Math.max(0, input.nowMs - new Date(startedAt).getTime()) : 0;
  const inPhaseProgress = Math.max(0, Math.min(1, elapsed / baseline));

  const progress = (completedCount + inPhaseProgress) / activePhases.length;
  return Math.max(0, Math.min(99, Math.round(progress * 100)));
}

function isPngBytes(bytes: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => bytes[index] === byte);
}

function nonArchitectureParagraphPrecheck(paragraph: string) {
  const text = paragraph.toLowerCase();
  const nonArchHits = NON_ARCH_PARAGRAPH_TERMS.filter((term) => text.includes(term)).length;
  const archHits = ARCH_PARAGRAPH_TERMS.filter((term) => text.includes(term)).length;

  if (nonArchHits >= 3 && archHits <= 1) {
    return {
      reject: true,
      reason: "Paragraph strongly resembles non-architecture content.",
    };
  }

  if (nonArchHits >= 2 && archHits <= 2) {
    return {
      reject: false,
      reason: "Paragraph includes mixed architecture and non-architecture signals.",
    };
  }

  return {
    reject: false,
    reason: null,
  };
}

async function fetchJob(jobId: string) {
  return db.architectureReviewJob.findUnique({
    where: { id: jobId },
  });
}

async function claimJob(jobId: string) {
  const staleBefore = new Date(Date.now() - LEASE_STALE_MS);
  const now = new Date();

  const result = await db.architectureReviewJob.updateMany({
    where: {
      id: jobId,
      status: {
        in: ["queued", "running"],
      },
      AND: [
        {
          OR: [{ status: "queued" }, { lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: staleBefore } }],
        },
        {
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
      ],
    },
    data: {
      status: "running",
      attemptCount: {
        increment: 1,
      },
      startedAt: now,
      lastHeartbeatAt: now,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return fetchJob(jobId);
}

async function updatePhase(job: ArchitectureReviewJob, phase: ArchitectureReviewPhase, action: "start" | "complete") {
  const now = new Date();
  const nowIso = now.toISOString();
  const timings = parsePhaseTimings(job.phaseTimingsJson);
  const nextTimings = action === "start" ? markPhaseStart(timings, phase, nowIso) : markPhaseComplete(timings, phase, nowIso);
  const deviceClass = parseDeviceClass(
    (job.submissionContextJson as { deviceClass?: unknown } | null | undefined)?.deviceClass,
  );

  const effectivePhase = action === "complete" && phase === "send-fallback" ? "completed" : phase;
  const progressPct =
    action === "complete" && phase === "send-fallback"
      ? 100
      : estimateProgressPct({
          currentPhase: effectivePhase,
          timings: nextTimings,
          deviceClass,
          nowMs: now.getTime(),
        });
  const etaSeconds =
    effectivePhase === "completed"
      ? 0
      : estimateEtaSeconds({
          currentPhase: effectivePhase,
          timings: nextTimings,
          deviceClass,
          nowMs: now.getTime(),
        });

  const updated = await db.architectureReviewJob.update({
    where: { id: job.id },
    data: {
      currentPhase: effectivePhase,
      phaseTimingsJson: nextTimings,
      progressPct,
      etaSeconds,
      lastHeartbeatAt: now,
      ...(effectivePhase === "completed"
        ? {
            completedAt: now,
          }
        : null),
    },
  });

  return updated;
}

async function failJob(job: ArchitectureReviewJob, errorMessage: string) {
  const retriable = job.attemptCount < MAX_ATTEMPTS;
  return db.architectureReviewJob.update({
    where: { id: job.id },
    data: {
      status: retriable ? "queued" : "failed",
      errorMessage,
      nextRetryAt: retriable ? new Date(Date.now() + 60_000) : null,
      lastHeartbeatAt: new Date(),
      currentPhase: retriable ? job.currentPhase : "completed",
      progressPct: retriable ? job.progressPct : 100,
      etaSeconds: retriable ? 45 : 0,
      completedAt: retriable ? null : new Date(),
      ...(retriable
        ? null
        : {
            diagramBytes: Buffer.alloc(0),
          }),
    },
  });
}

async function rejectJob(job: ArchitectureReviewJob, reason: string) {
  return db.architectureReviewJob.update({
    where: { id: job.id },
    data: {
      status: "rejected",
      fallbackReason: reason,
      errorMessage: reason,
      progressPct: 100,
      etaSeconds: 0,
      currentPhase: "completed",
      completedAt: new Date(),
      lastHeartbeatAt: new Date(),
      diagramBytes: Buffer.alloc(0),
    },
  });
}

function parseMetadata(job: ArchitectureReviewJob) {
  const parsed = submitArchitectureReviewMetadataSchema.safeParse(job.metadataJson);
  return parsed.success ? parsed.data : null;
}

function parseSubmissionContext(job: ArchitectureReviewJob) {
  const parsed = architectureReviewMetadataSchema.shape.submissionContext.safeParse(job.submissionContextJson);
  return parsed.success ? parsed.data : null;
}

function parseClientTiming(job: ArchitectureReviewJob) {
  const parsed = architectureReviewMetadataSchema.shape.clientTiming.safeParse(job.clientTimingJson);
  return parsed.success ? parsed.data : null;
}

function resolveAuthProvider(provider: string | null | undefined) {
  if (!provider || !provider.trim()) {
    return "credentials";
  }

  return provider;
}

async function persistAuditLog(input: {
  userId: string | null;
  action: string;
  metadata: Record<string, unknown>;
}) {
  try {
    await db.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        metadataJson: toInputJsonValue(input.metadata),
      },
    });
  } catch (error) {
    if (!isSchemaDriftError(error)) {
      throw error;
    }
  }
}

export async function createArchitectureReviewJob(input: {
  userId: string;
  userEmail: string;
  metadata: SubmitArchitectureReviewMetadata;
  diagramFileName: string;
  diagramMimeType: "image/png" | "image/svg+xml";
  diagramBytes: Uint8Array;
}) {
  return db.architectureReviewJob.create({
    data: {
      userId: input.userId,
      userEmail: input.userEmail,
      status: "queued",
      currentPhase: "upload-validate",
      progressPct: 0,
      etaSeconds: 0,
      metadataJson: toInputJsonValue(input.metadata),
      submissionContextJson: toNullableJsonValue(input.metadata.submissionContext),
      clientTimingJson: toNullableJsonValue(input.metadata.clientTiming),
      diagramFileName: input.diagramFileName,
      diagramMimeType: input.diagramMimeType,
      diagramBytes: Buffer.from(input.diagramBytes),
      phaseTimingsJson: {},
    },
  });
}

export async function processArchitectureReviewJob(jobId: string): Promise<ArchitectureReviewJob | null> {
  const claimed = await claimJob(jobId);
  if (!claimed) {
    return fetchJob(jobId);
  }

  let job = claimed;

  try {
    const metadata = parseMetadata(job);
    if (!metadata) {
      return failJob(job, "Invalid review metadata payload.");
    }

    job = await updatePhase(job, "upload-validate", "start");

    const diagramBytes = new Uint8Array(job.diagramBytes);
    const isPng = job.diagramMimeType === "image/png" || metadata.diagramFormat === "png" || job.diagramFileName.toLowerCase().endsWith(".png");
    const isSvg = job.diagramMimeType === "image/svg+xml" || metadata.diagramFormat === "svg" || job.diagramFileName.toLowerCase().endsWith(".svg");

    if (isPng && !isPngBytes(diagramBytes)) {
      return rejectJob(job, "Uploaded file is not a valid PNG diagram.");
    }

    if (!isPng && !isSvg) {
      return rejectJob(job, "Uploaded file type is unsupported for architecture review.");
    }

    job = await updatePhase(job, "upload-validate", "complete");
    job = await updatePhase(job, "diagram-precheck", "start");

    const paragraphPrecheck = nonArchitectureParagraphPrecheck(metadata.paragraphInput);
    if (paragraphPrecheck.reject) {
      return rejectJob(job, "Input appears to be non-architecture content. Upload a system architecture diagram.");
    }

    job = await updatePhase(job, "diagram-precheck", "complete");
    job = await updatePhase(job, "ocr", "start");

    const fallbackSvgEvidence = isSvg && !metadata.clientSvgText?.trim() ? extractSvgEvidenceFromBytes(diagramBytes) : null;
    const ocrText = isPng
      ? metadata.clientPngOcrText?.trim() ?? ""
      : (metadata.clientSvgText?.trim() || fallbackSvgEvidence?.text || "");

    if (isPng && ocrText.length === 0) {
      return rejectJob(job, "Missing browser PNG OCR evidence. Re-upload the diagram and retry.");
    }

    job = await updatePhase(job, "ocr", "complete");
    job = await updatePhase(job, "rules", "start");

    const bundle = createEvidenceBundle({
      provider: metadata.provider,
      paragraph: metadata.paragraphInput,
      ocrText,
      metadata: {
        diagramFormat: metadata.diagramFormat,
        title: metadata.title,
        owner: metadata.owner,
        lastUpdated: metadata.lastUpdated,
        version: metadata.version,
        legend: metadata.legend,
        workloadCriticality: metadata.workloadCriticality,
        regulatoryScope: metadata.regulatoryScope,
        environment: metadata.environment,
        lifecycleStage: metadata.lifecycleStage,
        desiredEngagement: metadata.desiredEngagement,
      },
    });

    const nonArchitectureEvidence = detectNonArchitectureEvidence(bundle);

    if (nonArchitectureEvidence.likely && nonArchitectureEvidence.confidence === "high") {
      return rejectJob(job, "Uploaded content appears to be non-architecture data. No email was sent.");
    }

    const report = buildReviewReportFromEvidence({
      bundle,
      userEmail: job.userEmail,
      quoteContext: {
        tokenCount: bundle.serviceTokens.length,
        ocrCharacterCount: ocrText.length,
        mode: "rules-only",
        workloadCriticality: metadata.workloadCriticality,
        desiredEngagement: metadata.desiredEngagement,
      },
      analysisConfidenceOverride:
        nonArchitectureEvidence.likely && nonArchitectureEvidence.confidence === "medium"
          ? "low"
          : metadata.analysisConfidence,
    });

    job = await updatePhase(job, "rules", "complete");
    job = await updatePhase(job, "package-email", "start");

    const userName =
      (await db.user.findUnique({ where: { id: job.userId ?? "" }, select: { name: true } }))?.name ??
      job.userEmail.split("@")[0] ??
      "user";

    const latestAccount = await (async () => {
      try {
        return await db.account.findFirst({
          where: { userId: job.userId ?? undefined },
          select: { provider: true },
          orderBy: { id: "desc" },
        });
      } catch (error) {
        if (!isSchemaDriftError(error)) {
          throw error;
        }

        return null;
      }
    })();

    const submissionContext = parseSubmissionContext(job);
    const clientTiming = parseClientTiming(job);

    const leadSchemaReady = await ensureLeadLogSchemaReady();
    let createdLead: { id: string } | null = null;

    if (leadSchemaReady) {
      try {
        createdLead = await db.leadLog.create({
          data: {
            userId: job.userId,
            userEmail: job.userEmail,
            userName,
            architectureProvider: report.provider,
            authProvider: resolveAuthProvider(latestAccount?.provider),
            overallScore: report.overallScore,
            analysisConfidence: report.analysisConfidence,
            quoteTier: report.quoteTier,
            topIssues: summarizeTopIssues(report.findings) || "none",
            inputParagraph: metadata.paragraphInput,
            reportJson: report,
            utmSource: submissionContext?.utmSource,
            utmMedium: submissionContext?.utmMedium,
            utmCampaign: submissionContext?.utmCampaign,
            landingPage: submissionContext?.landingPage,
            referrer: submissionContext?.referrer,
            deviceClass: submissionContext?.deviceClass,
            clientTimingJson: toNullableJsonValue(clientTiming),
            leadScore: calculateLeadScore({
              overallScore: report.overallScore,
              userEmail: job.userEmail,
              analysisConfidence: report.analysisConfidence,
              quoteTier: report.quoteTier,
              submissionContext,
            }),
            leadStage: "New Review",
            workdriveUploadStatus: "pending",
            emailDeliveryMode: "pending",
            zohoSyncNeedsUpdate: true,
          },
        });
      } catch (error) {
        if (!isSchemaDriftError(error)) {
          throw error;
        }

        createdLead = await db.leadLog.create({
          data: {
            userId: job.userId,
            userEmail: job.userEmail,
            architectureProvider: report.provider,
            authProvider: resolveAuthProvider(latestAccount?.provider),
            overallScore: report.overallScore,
            topIssues: summarizeTopIssues(report.findings) || "none",
          },
        });
      }
    }

    const archiveResult = await archiveArchitectureReviewToWorkDrive({
      diagramFileName: job.diagramFileName,
      diagramBytes,
      diagramMimeType: isPng ? "image/png" : "image/svg+xml",
      report,
      userName,
      paragraphInput: metadata.paragraphInput,
    });

    const workdriveStatus = archiveResult.error ? `${archiveResult.status}:${archiveResult.error}` : archiveResult.status;

    if (createdLead) {
      try {
        await db.leadLog.update({
          where: { id: createdLead.id },
          data: {
            workdriveDiagramFileId: archiveResult.diagramFileId,
            workdriveReportFileId: archiveResult.reportFileId,
            workdriveUploadStatus: workdriveStatus,
          },
        });
      } catch (error) {
        if (!isSchemaDriftError(error)) {
          throw error;
        }
      }
    }

    const ctaLinks = createdLead ? await buildArchitectureReviewCtaLinks(createdLead.id) : undefined;
    const emailContent = buildArchitectureReviewEmailContent(report, {
      ctaLinks,
    });

    const outbox = await db.architectureReviewEmailOutbox.create({
      data: {
        jobId: job.id,
        leadLogId: createdLead?.id ?? null,
        toEmail: job.userEmail,
        subject: emailContent.subject,
        textBody: emailContent.text,
        htmlBody: emailContent.html,
        status: "pending",
      },
    });

    job = await db.architectureReviewJob.update({
      where: { id: job.id },
      data: {
        leadLogId: createdLead?.id ?? null,
        reportJson: report,
        overallScore: report.overallScore,
        analysisConfidence: report.analysisConfidence,
        quoteTier: report.quoteTier,
      },
    });

    job = await updatePhase(job, "package-email", "complete");
    job = await updatePhase(job, "send-fallback", "start");

    const sendResult = await sendArchitectureReviewEmail({
      to: job.userEmail,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    if (sendResult.ok) {
      await db.architectureReviewEmailOutbox.update({
        where: { id: outbox.id },
        data: {
          status: "sent",
          attemptCount: {
            increment: 1,
          },
          provider: sendResult.provider,
          sentAt: new Date(),
          errorMessage: null,
        },
      });

      if (createdLead) {
        try {
          await db.leadLog.update({
            where: { id: createdLead.id },
            data: {
              emailDeliveryMode: "sent",
              leadStage: "Email Sent",
              emailSentAt: new Date(),
              zohoSyncNeedsUpdate: true,
            },
          });
        } catch (error) {
          if (!isSchemaDriftError(error)) {
            throw error;
          }
        }
      }

      const completed = await db.architectureReviewJob.update({
        where: { id: job.id },
        data: {
          status: "sent",
          deliveryMode: "sent",
          fallbackMailtoUrl: null,
          fallbackEmlToken: null,
          fallbackReason: null,
          progressPct: 100,
          etaSeconds: 0,
          currentPhase: "completed",
          completedAt: new Date(),
          lastHeartbeatAt: new Date(),
          diagramBytes: Buffer.alloc(0),
        },
      });

      await persistAuditLog({
        userId: job.userId,
        action: "tool.architecture_review_submit",
        metadata: {
          provider: report.provider,
          score: report.overallScore,
          confidence: report.analysisConfidence,
          quoteTier: report.quoteTier,
          findings: report.findings.length,
          ocrCharacterCount: ocrText.length,
          emailStatus: "sent",
          emailProvider: sendResult.provider,
          emailError: null,
          workdriveStatus,
          jobId: job.id,
        },
      });

      return completed;
    }

    const mailtoUrl = buildMailtoUrl({
      to: job.userEmail,
      subject: emailContent.subject,
      body: emailContent.text,
    });

    const secret = emlSecret();
    const emlToken =
      secret.length > 0
        ? createEmlToken(
            {
              to: job.userEmail,
              subject: emailContent.subject,
              body: emailContent.text,
            },
            secret,
          )
        : null;

    await db.architectureReviewEmailOutbox.update({
      where: { id: outbox.id },
      data: {
        status: "fallback",
        attemptCount: {
          increment: 1,
        },
        provider: sendResult.provider,
        errorMessage: sendResult.error ?? "EMAIL_DELIVERY_FAILED",
      },
    });

    if (createdLead) {
      try {
        await db.leadLog.update({
          where: { id: createdLead.id },
          data: {
            emailDeliveryMode: "fallback",
            leadStage: "New Review",
            zohoSyncNeedsUpdate: true,
          },
        });
      } catch (error) {
        if (!isSchemaDriftError(error)) {
          throw error;
        }
      }
    }

    const fallbackCompleted = await db.architectureReviewJob.update({
      where: { id: job.id },
      data: {
        status: "fallback",
        deliveryMode: "fallback",
        fallbackReason: sendResult.error ?? "Email delivery fallback triggered.",
        fallbackMailtoUrl: mailtoUrl,
        fallbackEmlToken: emlToken,
        currentPhase: "completed",
        progressPct: 100,
        etaSeconds: 0,
        completedAt: new Date(),
        lastHeartbeatAt: new Date(),
        diagramBytes: Buffer.alloc(0),
      },
    });

    await persistAuditLog({
      userId: job.userId,
      action: "tool.architecture_review_submit",
      metadata: {
        provider: report.provider,
        score: report.overallScore,
        confidence: report.analysisConfidence,
        quoteTier: report.quoteTier,
        findings: report.findings.length,
        ocrCharacterCount: ocrText.length,
        emailStatus: "fallback",
        emailProvider: sendResult.provider,
        emailError: sendResult.error,
        workdriveStatus,
        jobId: job.id,
      },
    });

    return fallbackCompleted;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unhandled architecture review processing failure.";
    return failJob(job, message);
  }
}

export async function getArchitectureReviewJobStatus(jobId: string) {
  const job = await fetchJob(jobId);
  if (!job) {
    return null;
  }

  if (job.status === "queued" || job.status === "running") {
    void processArchitectureReviewJob(job.id);
  }

  return job;
}

export type ArchitectureReviewQueueDrainResult = {
  scanned: number;
  processed: number;
  sent: number;
  fallback: number;
  rejected: number;
  failed: number;
  runningOrQueued: number;
};

export async function drainArchitectureReviewQueue(
  input?: { limit?: number },
): Promise<ArchitectureReviewQueueDrainResult> {
  const cappedLimit = Math.max(1, Math.min(10, Math.round(input?.limit ?? 1)));
  const now = new Date();
  const staleBefore = new Date(Date.now() - LEASE_STALE_MS);
  const candidates = await db.architectureReviewJob.findMany({
    where: {
      status: {
        in: ["queued", "running"],
      },
      AND: [
        {
          OR: [{ status: "queued" }, { lastHeartbeatAt: null }, { lastHeartbeatAt: { lt: staleBefore } }],
        },
        {
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
      ],
    },
    orderBy: {
      createdAt: "asc",
    },
    take: cappedLimit,
    select: {
      id: true,
    },
  });

  const summary: ArchitectureReviewQueueDrainResult = {
    scanned: candidates.length,
    processed: 0,
    sent: 0,
    fallback: 0,
    rejected: 0,
    failed: 0,
    runningOrQueued: 0,
  };

  for (const candidate of candidates) {
    const result = await processArchitectureReviewJob(candidate.id);
    if (!result) {
      continue;
    }

    summary.processed += 1;
    if (result.status === "sent") {
      summary.sent += 1;
      continue;
    }

    if (result.status === "fallback") {
      summary.fallback += 1;
      continue;
    }

    if (result.status === "rejected") {
      summary.rejected += 1;
      continue;
    }

    if (result.status === "failed") {
      summary.failed += 1;
      continue;
    }

    if (result.status === "queued" || result.status === "running") {
      summary.runningOrQueued += 1;
    }
  }

  return summary;
}

export function serializeArchitectureReviewJobStatus(job: ArchitectureReviewJob) {
  return {
    jobId: job.id,
    status: job.status as JobStatus,
    phase: (job.currentPhase ?? "upload-validate") as ArchitectureReviewPhase,
    progressPct: Math.max(0, Math.min(100, job.progressPct ?? 0)),
    etaSeconds: Math.max(0, job.etaSeconds ?? 0),
    deliveryMode: job.deliveryMode ?? null,
    error: job.status === "failed" ? job.errorMessage : null,
    reason: job.status === "rejected" ? job.fallbackReason ?? job.errorMessage : null,
    fallback: job.status === "fallback"
      ? {
          mailtoUrl: job.fallbackMailtoUrl ?? null,
          emlDownloadToken: job.fallbackEmlToken ?? null,
          reason: job.fallbackReason ?? "Email fallback triggered.",
        }
      : null,
  };
}

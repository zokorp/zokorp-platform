import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { buildArchitectureReviewEmailContent, buildMailtoUrl } from "@/lib/architecture-review/email";
import { createEmlToken } from "@/lib/architecture-review/eml-token";
import { buildArchitectureReviewReport, summarizeTopIssues } from "@/lib/architecture-review/report";
import { sendArchitectureReviewEmail } from "@/lib/architecture-review/sender";
import { submitArchitectureReviewPayloadSchema, type SubmitArchitectureReviewPayload } from "@/lib/architecture-review/types";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import { ensureLeadLogSchemaReady } from "@/lib/lead-log-schema";
import { archiveArchitectureReviewToWorkDrive } from "@/lib/zoho-workdrive";
import { z } from "zod";

export const runtime = "nodejs";

function emlSecret() {
  return process.env.ARCH_REVIEW_EML_SECRET ?? process.env.NEXTAUTH_SECRET ?? "";
}

function isPngBytes(bytes: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => bytes[index] === byte);
}

async function parsePayloadFromRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const reportRaw = formData.get("report");
    const metadataRaw = formData.get("metadata");
    const diagramRaw = formData.get("diagram");

    if (typeof reportRaw !== "string" || typeof metadataRaw !== "string") {
      throw new Error("INVALID_PAYLOAD");
    }

    const payload = submitArchitectureReviewPayloadSchema.parse({
      report: JSON.parse(reportRaw),
      metadata: JSON.parse(metadataRaw),
    });

    if (diagramRaw instanceof File) {
      const bytes = new Uint8Array(await diagramRaw.arrayBuffer());
      if (diagramRaw.type !== "image/png" || !isPngBytes(bytes)) {
        throw new Error("INVALID_DIAGRAM_FILE");
      }

      return {
        payload,
        diagram: {
          filename: diagramRaw.name,
          bytes,
        },
      } as const;
    }

    return {
      payload,
      diagram: null,
    } as const;
  }

  const rawBody = await request.json();
  const payload = submitArchitectureReviewPayloadSchema.parse(rawBody);

  return {
    payload,
    diagram: null,
  } as const;
}

function normalizeFindingsForFinalScoring(payload: SubmitArchitectureReviewPayload) {
  return payload.report.findings.map((finding) => ({
    ruleId: finding.ruleId,
    category: finding.category,
    pointsDeducted: finding.pointsDeducted,
    message: finding.message,
    fix: finding.fix,
    evidence: finding.evidence,
  }));
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!user.email) {
      return NextResponse.json({ error: "Account email is required." }, { status: 400 });
    }

    const { payload, diagram } = await parsePayloadFromRequest(request);

    const finalizedReport = buildArchitectureReviewReport({
      provider: payload.report.provider,
      flowNarrative: payload.report.flowNarrative,
      findings: normalizeFindingsForFinalScoring(payload),
      userEmail: user.email,
      generatedAtISO: new Date().toISOString(),
    });
    const resolvedUserName = user.name?.trim() || user.email.split("@")[0] || "user";

    const latestAccount = await (async () => {
      try {
        return await db.account.findFirst({
          where: { userId: user.id },
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

    const leadData = {
      userId: user.id,
      userEmail: user.email,
      userName: resolvedUserName,
      architectureProvider: finalizedReport.provider,
      authProvider: latestAccount?.provider ?? "credentials",
      overallScore: finalizedReport.overallScore,
      topIssues: summarizeTopIssues(finalizedReport.findings) || "none",
      inputParagraph: payload.metadata.paragraphInput ?? null,
      reportJson: finalizedReport,
      workdriveUploadStatus: diagram ? "pending" : "skipped",
    } as const;

    const leadSchemaReady = await ensureLeadLogSchemaReady();
    const createdLead = leadSchemaReady
      ? await (async () => {
          try {
            return await db.leadLog.create({
              data: leadData,
            });
          } catch (error) {
            if (!isSchemaDriftError(error)) {
              throw error;
            }

            return db.leadLog.create({
              data: {
                userId: leadData.userId,
                userEmail: leadData.userEmail,
                architectureProvider: leadData.architectureProvider,
                authProvider: leadData.authProvider,
                overallScore: leadData.overallScore,
                topIssues: leadData.topIssues,
              },
            });
          }
        })()
      : null;

    let workdriveStatus = createdLead?.workdriveUploadStatus ?? (diagram ? "pending" : "skipped");

    if (diagram) {
      const archiveResult = await archiveArchitectureReviewToWorkDrive({
        diagramFileName: diagram.filename,
        diagramBytes: diagram.bytes,
        report: finalizedReport,
        userName: resolvedUserName,
        paragraphInput: payload.metadata.paragraphInput ?? "",
      });

      workdriveStatus = archiveResult.error ? `${archiveResult.status}:${archiveResult.error}` : archiveResult.status;

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
    }

    const emailContent = buildArchitectureReviewEmailContent(finalizedReport);
    const sendResult = await sendArchitectureReviewEmail({
      to: user.email,
      subject: emailContent.subject,
      text: emailContent.text,
    });

    try {
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: "tool.architecture_review_submit",
          metadataJson: {
            provider: finalizedReport.provider,
            score: finalizedReport.overallScore,
            findings: finalizedReport.findings.length,
            emailStatus: sendResult.ok ? "sent" : "fallback",
            emailProvider: sendResult.provider,
            emailError: sendResult.error ?? null,
            workdriveStatus,
          },
        },
      });
    } catch (error) {
      if (!isSchemaDriftError(error)) {
        throw error;
      }
    }

    if (sendResult.ok) {
      return NextResponse.json({
        status: "sent",
      });
    }

    const mailtoUrl = buildMailtoUrl({
      to: user.email,
      subject: emailContent.subject,
      body: emailContent.text,
    });

    const secret = emlSecret();
    if (!secret) {
      if (mailtoUrl) {
        return NextResponse.json({
          status: "fallback",
          reason: "Email sending failed. Use the mailto draft fallback.",
          mailtoUrl,
        });
      }

      return NextResponse.json(
        {
          error: "Email fallback is not configured. Set ARCH_REVIEW_EML_SECRET to enable .eml downloads.",
        },
        { status: 503 },
      );
    }

    const emlDownloadToken = createEmlToken(
      {
        to: user.email,
        subject: emailContent.subject,
        body: emailContent.text,
      },
      secret,
    );

    return NextResponse.json({
      status: "fallback",
      reason: sendResult.error ?? "Email delivery fallback triggered.",
      mailtoUrl,
      emlDownloadToken,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && error.message === "INVALID_DIAGRAM_FILE") {
      return NextResponse.json({ error: "Invalid diagram file. Upload a PNG." }, { status: 400 });
    }

    if (error instanceof Error && error.message === "INVALID_PAYLOAD") {
      return NextResponse.json({ error: "Invalid review payload." }, { status: 400 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid review payload." }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to submit architecture review." }, { status: 500 });
  }
}

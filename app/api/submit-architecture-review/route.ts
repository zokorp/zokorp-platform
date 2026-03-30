import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import {
  createArchitectureReviewJob,
  processArchitectureReviewJob,
  serializeArchitectureReviewJobStatus,
} from "@/lib/architecture-review/jobs";
import { isSafeSvgBytes } from "@/lib/architecture-review/server";
import { submitArchitectureReviewMetadataSchema } from "@/lib/architecture-review/types";
import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import { isFreeToolAccessError, requireVerifiedFreeToolAccess } from "@/lib/free-tool-access";
import { normalizeIdempotencyKey, readIdempotencyEntry, writeIdempotencyEntry } from "@/lib/idempotency-cache";
import { requireSameOrigin } from "@/lib/request-origin";
import { consumeRateLimit, getRequestFingerprint } from "@/lib/rate-limit";
import { maxUploadBytes } from "@/lib/security";
import { archiveArchitectureDiagramToWorkDrive, formatWorkDriveArchiveStatus } from "@/lib/zoho-workdrive";

export const runtime = "nodejs";

const ARCHITECTURE_REVIEW_MAX_MB = Number(process.env.ARCHITECTURE_REVIEW_UPLOAD_MAX_MB ?? "8");
const ARCH_REVIEW_RATE_LIMIT = 8;
const ARCH_REVIEW_WINDOW_MS = 60 * 60 * 1000;
const ARCH_REVIEW_DAILY_LIMIT = Number(process.env.ARCH_REVIEW_DAILY_LIMIT ?? "24");
const MAX_METADATA_JSON_CHARS = 120_000;

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type ParsedDiagram = {
  filename: string;
  bytes: Uint8Array;
  format: "png" | "jpg" | "pdf" | "svg";
  mimeType: "image/png" | "image/jpeg" | "application/pdf" | "image/svg+xml";
};

function responseHeaders(requestId: string, limiter?: RateLimitResult) {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
  };

  if (limiter) {
    headers["X-RateLimit-Limit"] = String(ARCH_REVIEW_RATE_LIMIT);
    headers["X-RateLimit-Remaining"] = String(limiter.remaining);
    headers["X-RateLimit-Reset"] = String(Math.floor(Date.now() / 1000) + limiter.retryAfterSeconds);
  }

  return headers;
}

function jsonResponse(
  requestId: string,
  body: Record<string, unknown>,
  status = 200,
  limiter?: RateLimitResult,
  extraHeaders?: Record<string, string>,
) {
  return NextResponse.json(
    {
      ...body,
      requestId,
    },
    {
      status,
      headers: {
        ...responseHeaders(requestId, limiter),
        ...(extraHeaders ?? {}),
      },
    },
  );
}

function isPngBytes(bytes: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => bytes[index] === byte);
}

function isJpegBytes(bytes: Uint8Array) {
  const signature = [0xff, 0xd8, 0xff];
  if (bytes.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => bytes[index] === byte);
}

function isPdfBytes(bytes: Uint8Array) {
  const signature = [0x25, 0x50, 0x44, 0x46];
  if (bytes.length < signature.length) {
    return false;
  }

  return signature.every((byte, index) => bytes[index] === byte);
}

function wantsFollowUpArchive(metadata: z.infer<typeof submitArchitectureReviewMetadataSchema>) {
  return metadata.saveForFollowUp ?? metadata.archiveForFollowup ?? false;
}

async function parsePayloadFromRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    throw new Error("INVALID_PAYLOAD");
  }

  const formData = await request.formData();
  const metadataRaw = formData.get("metadata");
  const diagramRaw = formData.get("diagram");

  if (typeof metadataRaw !== "string" || !(diagramRaw instanceof File)) {
    throw new Error("INVALID_PAYLOAD");
  }

  if (metadataRaw.length <= 0 || metadataRaw.length > MAX_METADATA_JSON_CHARS) {
    throw new Error("INVALID_PAYLOAD");
  }

  const maxBytes = maxUploadBytes(ARCHITECTURE_REVIEW_MAX_MB);
  if (diagramRaw.size <= 0 || diagramRaw.size > maxBytes) {
    throw new Error("DIAGRAM_TOO_LARGE");
  }

  const metadata = submitArchitectureReviewMetadataSchema.parse(JSON.parse(metadataRaw));
  if (metadata.provider !== "aws") {
    throw new Error("UNSUPPORTED_PROVIDER");
  }
  const bytes = new Uint8Array(await diagramRaw.arrayBuffer());
  if (bytes.length > maxBytes) {
    throw new Error("DIAGRAM_TOO_LARGE");
  }

  const lowerName = diagramRaw.name.toLowerCase();
  if (lowerName.endsWith(".png")) {
    if (metadata.diagramFormat && metadata.diagramFormat !== "png") {
      throw new Error("DIAGRAM_FORMAT_MISMATCH");
    }

    if (!isPngBytes(bytes)) {
      throw new Error("INVALID_DIAGRAM_FILE");
    }

    if (!metadata.clientPngOcrText?.trim()) {
      throw new Error("MISSING_DIAGRAM_EVIDENCE");
    }

    return {
      metadata,
      diagram: {
        filename: diagramRaw.name,
        bytes,
        format: "png",
        mimeType: "image/png",
      } satisfies ParsedDiagram,
    } as const;
  }

  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    if (metadata.diagramFormat && metadata.diagramFormat !== "jpg") {
      throw new Error("DIAGRAM_FORMAT_MISMATCH");
    }

    if (!isJpegBytes(bytes)) {
      throw new Error("INVALID_DIAGRAM_FILE");
    }

    if (!metadata.clientPngOcrText?.trim()) {
      throw new Error("MISSING_DIAGRAM_EVIDENCE");
    }

    return {
      metadata,
      diagram: {
        filename: diagramRaw.name,
        bytes,
        format: "jpg",
        mimeType: "image/jpeg",
      } satisfies ParsedDiagram,
    } as const;
  }

  if (lowerName.endsWith(".pdf")) {
    if (metadata.diagramFormat && metadata.diagramFormat !== "pdf") {
      throw new Error("DIAGRAM_FORMAT_MISMATCH");
    }

    if (!isPdfBytes(bytes)) {
      throw new Error("INVALID_DIAGRAM_FILE");
    }

    const pdfParseModule = await import("pdf-parse");
    const parsed = await pdfParseModule.default(Buffer.from(bytes));
    const clientPdfText = (parsed.text || "").replace(/\s+/g, " ").trim();

    if (!clientPdfText) {
      throw new Error("MISSING_DIAGRAM_EVIDENCE");
    }

    return {
      metadata: {
        ...metadata,
        clientPdfText,
      },
      diagram: {
        filename: diagramRaw.name,
        bytes,
        format: "pdf",
        mimeType: "application/pdf",
      } satisfies ParsedDiagram,
    } as const;
  }

  if (!lowerName.endsWith(".svg")) {
    throw new Error("INVALID_DIAGRAM_FILE");
  }

  if (metadata.diagramFormat && metadata.diagramFormat !== "svg") {
    throw new Error("DIAGRAM_FORMAT_MISMATCH");
  }

  if (!isSafeSvgBytes(bytes)) {
    throw new Error("INVALID_DIAGRAM_FILE");
  }

  if (!metadata.clientSvgText?.trim()) {
    throw new Error("MISSING_DIAGRAM_EVIDENCE");
  }

  return {
    metadata,
    diagram: {
      filename: diagramRaw.name,
      bytes,
      format: "svg",
      mimeType: "image/svg+xml",
    } satisfies ParsedDiagram,
  } as const;
}

async function exceedsDailyLimit(userId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await db.architectureReviewJob.count({
    where: {
      userId,
      createdAt: { gte: since },
    },
  });

  return count >= Math.max(1, ARCH_REVIEW_DAILY_LIMIT);
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  let limiterContext: RateLimitResult | undefined;

  try {
    const crossSiteResponse = requireSameOrigin(request);
    if (crossSiteResponse) {
      return crossSiteResponse;
    }

    const access = await requireVerifiedFreeToolAccess({
      toolName: "Architecture Diagram Reviewer",
    });
    const user = access.user;
    const userEmail = access.email;

    const incomingIdempotencyKey = normalizeIdempotencyKey(request.headers.get("x-idempotency-key"));
    const idempotencyCacheKey = incomingIdempotencyKey
      ? `arch-review:${user.id}:${incomingIdempotencyKey}`
      : null;

    if (idempotencyCacheKey) {
      const cached = readIdempotencyEntry(idempotencyCacheKey);
      if (cached) {
        const cachedRequestId = typeof cached.body.requestId === "string" ? cached.body.requestId : requestId;
        return NextResponse.json(cached.body, {
          status: cached.status,
          headers: {
            ...responseHeaders(cachedRequestId),
            "X-Idempotent-Replay": "1",
          },
        });
      }
    }

    const limiter = await consumeRateLimit({
      key: `arch-review:${user.id}:${getRequestFingerprint(request)}`,
      limit: ARCH_REVIEW_RATE_LIMIT,
      windowMs: ARCH_REVIEW_WINDOW_MS,
    });
    limiterContext = limiter;

    if (!limiter.allowed) {
      return jsonResponse(
        requestId,
        { error: "Too many architecture review requests. Please retry later." },
        429,
        limiter,
        {
          "Retry-After": String(limiter.retryAfterSeconds),
        },
      );
    }

    if (await exceedsDailyLimit(user.id)) {
      return jsonResponse(
        requestId,
        {
          error: `Daily review limit reached (${ARCH_REVIEW_DAILY_LIMIT}/day). Please retry tomorrow.`,
        },
        429,
        limiterContext,
      );
    }

    const { metadata, diagram } = await parsePayloadFromRequest(request);
    const saveForFollowUp = wantsFollowUpArchive(metadata);
    const diagramArchiveResult = saveForFollowUp
      ? await archiveArchitectureDiagramToWorkDrive({
          diagramFileName: diagram.filename,
          diagramBytes: diagram.bytes,
          diagramMimeType:
            diagram.mimeType === "image/png" || diagram.mimeType === "image/svg+xml" ? diagram.mimeType : undefined,
        })
      : {
          status: "not_requested",
          fileId: null,
          error: null,
        };

    const createdJob = await createArchitectureReviewJob({
      userId: user.id,
      userEmail,
      metadata,
      diagramFileName: diagram.filename,
      diagramMimeType: diagram.mimeType,
      workdriveDiagramFileId: diagramArchiveResult.fileId,
      workdriveUploadStatus:
        saveForFollowUp && diagramArchiveResult.fileId
          ? "diagram_uploaded"
          : formatWorkDriveArchiveStatus(diagramArchiveResult),
    });

    const processedJob = await processArchitectureReviewJob(createdJob.id);
    const finalJob = processedJob ?? createdJob;
    const serializedStatus = serializeArchitectureReviewJobStatus(finalJob);
    const responseStatus =
      serializedStatus.status === "sent" ||
      serializedStatus.status === "fallback" ||
      serializedStatus.status === "failed" ||
      serializedStatus.status === "rejected"
        ? 200
        : 202;
    const body = serializedStatus;

    if (idempotencyCacheKey) {
      writeIdempotencyEntry(idempotencyCacheKey, { status: responseStatus, body: { ...body, requestId } });
    }

    return jsonResponse(requestId, body, responseStatus, limiterContext);
  } catch (error) {
    if (isFreeToolAccessError(error)) {
      return jsonResponse(requestId, { error: error.message }, error.status, limiterContext);
    }

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonResponse(requestId, { error: "Unauthorized" }, 401, limiterContext);
    }

    if (error instanceof Error && (error.message === "INVALID_DIAGRAM_FILE" || error.message === "INVALID_SVG_FILE")) {
      return jsonResponse(requestId, { error: "Invalid diagram file. Upload a safe PNG, JPG, PDF, or SVG." }, 400, limiterContext);
    }

    if (error instanceof Error && error.message === "UNSUPPORTED_PROVIDER") {
      return jsonResponse(
        requestId,
        { error: "Architecture Diagram Reviewer is AWS-only right now. Choose AWS and retry." },
        400,
        limiterContext,
      );
    }

    if (error instanceof Error && error.message === "DIAGRAM_FORMAT_MISMATCH") {
      return jsonResponse(
        requestId,
        { error: "Diagram metadata format does not match the uploaded file type." },
        400,
        limiterContext,
      );
    }

    if (error instanceof Error && error.message === "MISSING_DIAGRAM_EVIDENCE") {
      return jsonResponse(
        requestId,
        { error: "Missing browser-extracted diagram evidence. Re-upload the file and retry." },
        422,
        limiterContext,
      );
    }

    if (error instanceof Error && error.message === "DIAGRAM_TOO_LARGE") {
      return jsonResponse(
        requestId,
        { error: `Diagram too large. Max allowed is ${ARCHITECTURE_REVIEW_MAX_MB}MB.` },
        413,
        limiterContext,
      );
    }

    if (error instanceof Error && error.message === "INVALID_PAYLOAD") {
      return jsonResponse(requestId, { error: "Invalid review payload." }, 400, limiterContext);
    }

    if (error instanceof SyntaxError) {
      return jsonResponse(requestId, { error: "Invalid review payload." }, 400, limiterContext);
    }

    if (error instanceof z.ZodError) {
      return jsonResponse(requestId, { error: "Invalid review payload." }, 400, limiterContext);
    }

    if (isSchemaDriftError(error)) {
      return jsonResponse(
        requestId,
        { error: "Architecture review jobs are being enabled. Run migrations and retry." },
        503,
        limiterContext,
      );
    }

    console.error("submit-architecture-review unhandled error", { requestId, error });
    return jsonResponse(requestId, { error: "Unable to submit architecture review." }, 500, limiterContext);
  }
}

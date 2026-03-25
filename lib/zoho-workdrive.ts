import type { ArchitectureReviewReport } from "@/lib/architecture-review/types";
import { FetchTimeoutError, fetchWithTimeout, readResponseBodySnippet } from "@/lib/http";

function hasWorkDriveRefreshCredentials() {
  return (
    Boolean(process.env.ZOHO_WORKDRIVE_REFRESH_TOKEN || process.env.ZOHO_CRM_REFRESH_TOKEN) &&
    Boolean(process.env.ZOHO_WORKDRIVE_CLIENT_ID || process.env.ZOHO_CLIENT_ID) &&
    Boolean(process.env.ZOHO_WORKDRIVE_CLIENT_SECRET || process.env.ZOHO_CLIENT_SECRET)
  );
}

function getAccountsDomain() {
  return process.env.ZOHO_WORKDRIVE_ACCOUNTS_DOMAIN ?? process.env.ZOHO_ACCOUNTS_DOMAIN ?? "https://accounts.zoho.com";
}

function normalizeOrigin(value: string) {
  return value.replace(/\/+$/, "");
}

export function resolveWorkDriveUploadOrigin() {
  const explicitOrigin = process.env.ZOHO_WORKDRIVE_API_ORIGIN?.trim();
  if (explicitOrigin) {
    return explicitOrigin.startsWith("http://") || explicitOrigin.startsWith("https://")
      ? normalizeOrigin(explicitOrigin)
      : normalizeOrigin(`https://${explicitOrigin}`);
  }

  const legacyValue = process.env.ZOHO_WORKDRIVE_BASE_API_URI?.trim();
  if (!legacyValue) {
    return "https://workdrive.zoho.com";
  }

  if (legacyValue.startsWith("http://") || legacyValue.startsWith("https://")) {
    return normalizeOrigin(legacyValue);
  }

  if (legacyValue.startsWith("workdrive.")) {
    return normalizeOrigin(`https://${legacyValue}`);
  }

  // Legacy values like `zohoapis.com` are not valid WorkDrive upload hosts.
  // Fall back to Zoho's documented WorkDrive origin unless an explicit host is supplied.
  return "https://workdrive.zoho.com";
}

function getWorkDriveFolderId() {
  return process.env.ZOHO_WORKDRIVE_FOLDER_ID ?? "";
}

async function refreshWorkDriveAccessToken() {
  if (!hasWorkDriveRefreshCredentials()) {
    return null;
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: process.env.ZOHO_WORKDRIVE_REFRESH_TOKEN ?? process.env.ZOHO_CRM_REFRESH_TOKEN!,
    client_id: process.env.ZOHO_WORKDRIVE_CLIENT_ID ?? process.env.ZOHO_CLIENT_ID!,
    client_secret: process.env.ZOHO_WORKDRIVE_CLIENT_SECRET ?? process.env.ZOHO_CLIENT_SECRET!,
  });

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${getAccountsDomain().replace(/\/$/, "")}/oauth/v2/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
      10_000,
    );
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    return null;
  }

  return payload.access_token;
}

async function getWorkDriveAccessToken() {
  const direct = process.env.ZOHO_WORKDRIVE_ACCESS_TOKEN ?? process.env.ZOHO_CRM_ACCESS_TOKEN;
  if (direct) {
    return direct;
  }

  return refreshWorkDriveAccessToken();
}

function extractWorkDriveFileId(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const data = (body as { data?: unknown }).data;
  if (Array.isArray(data) && data.length > 0) {
    const first = data[0] as { id?: string; attributes?: { resource_id?: string; id?: string } };
    return first?.id ?? first?.attributes?.resource_id ?? first?.attributes?.id ?? null;
  }

  if (data && typeof data === "object") {
    const single = data as { id?: string; attributes?: { resource_id?: string; id?: string } };
    return single.id ?? single.attributes?.resource_id ?? single.attributes?.id ?? null;
  }

  return null;
}

async function uploadFile(input: {
  token: string;
  folderId: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}) {
  const endpoint = `${resolveWorkDriveUploadOrigin()}/api/v1/upload`;
  const form = new FormData();
  form.append("filename", input.filename);
  form.append("parent_id", input.folderId);
  form.append("override-name-exist", "false");
  form.append("content", new Blob([Buffer.from(input.bytes)], { type: input.mimeType }), input.filename);

  let response: Response;
  try {
    response = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.token}`,
        },
        body: form,
      },
      20_000,
    );
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      return {
        ok: false,
        fileId: null,
        error: "WORKDRIVE_TIMEOUT",
      } as const;
    }

    return {
      ok: false,
      fileId: null,
      error: `WORKDRIVE_NETWORK:${error instanceof Error ? error.message : "unknown_error"}`,
    } as const;
  }

  const bodyText = await response.text();
  let parsedBody: unknown = null;
  try {
    parsedBody = JSON.parse(bodyText);
  } catch {
    parsedBody = bodyText;
  }

  if (!response.ok) {
    const bodySnippet =
      typeof parsedBody === "string"
        ? readResponseBodySnippet(parsedBody, 300)
        : readResponseBodySnippet(JSON.stringify(parsedBody), 300);

    return {
      ok: false,
      fileId: null,
      error: `WORKDRIVE_${response.status}:${bodySnippet}`,
    } as const;
  }

  return {
    ok: true,
    fileId: extractWorkDriveFileId(parsedBody),
    error: null,
  } as const;
}

function sanitizeFilenamePart(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
}

type WorkDriveArchiveResult = {
  status: string;
  fileId: string | null;
  error: string | null;
};

export function formatWorkDriveArchiveStatus(
  input: Pick<WorkDriveArchiveResult, "status" | "error">,
  successStatus?: string,
) {
  if (input.error) {
    return `${input.status}:${input.error}`;
  }

  return successStatus ?? input.status;
}

export async function archiveArchitectureDiagramToWorkDrive(input: {
  diagramFileName: string;
  diagramBytes: Uint8Array;
  diagramMimeType?: "image/png" | "image/svg+xml";
}) {
  try {
    const folderId = getWorkDriveFolderId();
    if (!folderId) {
      return {
        status: "skipped",
        fileId: null,
        error: "WORKDRIVE_FOLDER_NOT_CONFIGURED",
      } satisfies WorkDriveArchiveResult;
    }

    const token = await getWorkDriveAccessToken();
    if (!token) {
      return {
        status: "failed",
        fileId: null,
        error: "WORKDRIVE_ACCESS_TOKEN_NOT_AVAILABLE",
      } satisfies WorkDriveArchiveResult;
    }
    let activeToken = token;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const diagramName = `${timestamp}_${sanitizeFilenamePart(input.diagramFileName) || "diagram.png"}`;
    const diagramMimeType = input.diagramMimeType === "image/svg+xml" ? "image/svg+xml" : "image/png";

    let diagramUpload = await uploadFile({
      token: activeToken,
      folderId,
      filename: diagramName,
      mimeType: diagramMimeType,
      bytes: input.diagramBytes,
    });

    if (!diagramUpload.ok) {
      const refreshed = await refreshWorkDriveAccessToken();
      if (!refreshed) {
        return {
          status: "failed",
          fileId: null,
          error: diagramUpload.error,
        } satisfies WorkDriveArchiveResult;
      }

      activeToken = refreshed;
      diagramUpload = await uploadFile({
        token: activeToken,
        folderId,
        filename: diagramName,
        mimeType: diagramMimeType,
        bytes: input.diagramBytes,
      });

      if (!diagramUpload.ok) {
        return {
          status: "failed",
          fileId: null,
          error: diagramUpload.error,
        } satisfies WorkDriveArchiveResult;
      }
    }

    return {
      status: "uploaded",
      fileId: diagramUpload.fileId,
      error: null,
    } satisfies WorkDriveArchiveResult;
  } catch (error) {
    return {
      status: "failed",
      fileId: null,
      error: `WORKDRIVE_UNEXPECTED:${error instanceof Error ? error.message : "unknown_error"}`,
    } satisfies WorkDriveArchiveResult;
  }
}

export async function archiveArchitectureReviewReportToWorkDrive(input: {
  report: ArchitectureReviewReport;
  userName: string | null;
  paragraphInput: string;
}) {
  try {
    const folderId = getWorkDriveFolderId();
    if (!folderId) {
      return {
        status: "skipped",
        fileId: null,
        error: "WORKDRIVE_FOLDER_NOT_CONFIGURED",
      } satisfies WorkDriveArchiveResult;
    }

    const token = await getWorkDriveAccessToken();
    if (!token) {
      return {
        status: "failed",
        fileId: null,
        error: "WORKDRIVE_ACCESS_TOKEN_NOT_AVAILABLE",
      } satisfies WorkDriveArchiveResult;
    }
    let activeToken = token;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const emailPart = sanitizeFilenamePart(input.report.userEmail);
    const reportPayload = {
      userEmail: input.report.userEmail,
      userName: input.userName,
      paragraphInput: input.paragraphInput,
      report: input.report,
    };
    const reportBytes = new TextEncoder().encode(JSON.stringify(reportPayload, null, 2));
    const reportName = `${timestamp}_${emailPart}_architecture-review.json`;

    let reportUpload = await uploadFile({
      token: activeToken,
      folderId,
      filename: reportName,
      mimeType: "application/json",
      bytes: reportBytes,
    });

    if (!reportUpload.ok) {
      const refreshed = await refreshWorkDriveAccessToken();
      if (refreshed) {
        activeToken = refreshed;
        reportUpload = await uploadFile({
          token: activeToken,
          folderId,
          filename: reportName,
          mimeType: "application/json",
          bytes: reportBytes,
        });
      }
    }

    if (!reportUpload.ok) {
      return {
        status: "failed",
        fileId: null,
        error: reportUpload.error,
      } satisfies WorkDriveArchiveResult;
    }

    return {
      status: "uploaded",
      fileId: reportUpload.fileId,
      error: null,
    } satisfies WorkDriveArchiveResult;
  } catch (error) {
    return {
      status: "failed",
      fileId: null,
      error: `WORKDRIVE_UNEXPECTED:${error instanceof Error ? error.message : "unknown_error"}`,
    } satisfies WorkDriveArchiveResult;
  }
}

export async function archiveArchitectureReviewToWorkDrive(input: {
  diagramFileName: string;
  diagramBytes: Uint8Array;
  diagramMimeType?: "image/png" | "image/svg+xml";
  report: ArchitectureReviewReport;
  userName: string | null;
  paragraphInput: string;
}) {
  const diagramResult = await archiveArchitectureDiagramToWorkDrive({
    diagramFileName: input.diagramFileName,
    diagramBytes: input.diagramBytes,
    diagramMimeType: input.diagramMimeType,
  });

  if (diagramResult.error || !diagramResult.fileId) {
    return {
      status: diagramResult.status,
      diagramFileId: diagramResult.fileId,
      reportFileId: null,
      error: diagramResult.error,
    } as const;
  }

  const reportResult = await archiveArchitectureReviewReportToWorkDrive({
    report: input.report,
    userName: input.userName,
    paragraphInput: input.paragraphInput,
  });

  return {
    status: reportResult.status,
    diagramFileId: diagramResult.fileId,
    reportFileId: reportResult.fileId,
    error: reportResult.error,
  } as const;
}

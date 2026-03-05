import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";

export const runtime = "nodejs";

function normalizeCompanyFromEmail(email: string) {
  const domain = email.split("@")[1] ?? "unknown-company";
  return domain.split(".")[0]?.slice(0, 80) || "Unknown Company";
}

function normalizeLastNameFromEmail(email: string) {
  const local = email.split("@")[0] ?? "lead";
  return local.slice(0, 80) || "Lead";
}

function normalizeLastName(input: { email: string; userName: string | null }) {
  if (input.userName?.trim()) {
    const last = input.userName.trim().split(/\s+/).at(-1);
    if (last) {
      return last.slice(0, 80);
    }
  }

  return normalizeLastNameFromEmail(input.email);
}

function isDuplicateCode(code?: string) {
  return code === "DUPLICATE_DATA" || code === "DUPLICATE_LINKING_DATA";
}

function hasZohoRefreshCredentials() {
  return (
    Boolean(process.env.ZOHO_CRM_REFRESH_TOKEN) &&
    Boolean(process.env.ZOHO_CLIENT_ID) &&
    Boolean(process.env.ZOHO_CLIENT_SECRET)
  );
}

async function refreshZohoAccessToken() {
  if (!hasZohoRefreshCredentials()) {
    return null;
  }

  const accountsDomain = process.env.ZOHO_ACCOUNTS_DOMAIN ?? "https://accounts.zoho.com";
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: process.env.ZOHO_CRM_REFRESH_TOKEN!,
    client_id: process.env.ZOHO_CLIENT_ID!,
    client_secret: process.env.ZOHO_CLIENT_SECRET!,
  });

  const response = await fetch(`${accountsDomain}/oauth/v2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    return null;
  }

  return payload.access_token;
}

export async function POST(request: Request) {
  const syncSecret = process.env.ZOHO_SYNC_SECRET;
  const providedSecret =
    request.headers.get("x-zoho-sync-secret") ??
    request.headers.get("x-sync-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!syncSecret || !providedSecret || providedSecret !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let accessToken = process.env.ZOHO_CRM_ACCESS_TOKEN ?? "";
  if (!accessToken) {
    const refreshed = await refreshZohoAccessToken();
    if (refreshed) {
      accessToken = refreshed;
    }
  }

  if (!accessToken) {
    return NextResponse.json(
      {
        error:
          "Zoho access token is missing. Set ZOHO_CRM_ACCESS_TOKEN or refresh credentials.",
      },
      { status: 500 },
    );
  }

  const zohoBase = process.env.ZOHO_CRM_API_DOMAIN ?? "https://www.zohoapis.com";

  try {
    const pendingLeads = await (async () => {
      try {
        return await db.leadLog.findMany({
          where: {
            syncedToZohoAt: null,
          },
          orderBy: { createdAt: "asc" },
          take: 100,
          select: {
            id: true,
            userEmail: true,
            userName: true,
            architectureProvider: true,
            overallScore: true,
            topIssues: true,
            authProvider: true,
            workdriveUploadStatus: true,
            createdAt: true,
          },
        });
      } catch (error) {
        if (!isSchemaDriftError(error)) {
          throw error;
        }

        const legacyLeads = await db.leadLog.findMany({
          where: {
            syncedToZohoAt: null,
          },
          orderBy: { createdAt: "asc" },
          take: 100,
          select: {
            id: true,
            userEmail: true,
            architectureProvider: true,
            overallScore: true,
            topIssues: true,
            authProvider: true,
            createdAt: true,
          },
        });

        return legacyLeads.map((lead) => ({
          ...lead,
          userName: null,
          workdriveUploadStatus: null,
        }));
      }
    })();

    if (pendingLeads.length === 0) {
      return NextResponse.json({ status: "ok", synced: 0, skipped: 0, failed: 0, message: "No new leads." });
    }

    const data = pendingLeads.map((lead) => ({
      Last_Name: normalizeLastName({ email: lead.userEmail, userName: lead.userName }),
      Company: normalizeCompanyFromEmail(lead.userEmail),
      Email: lead.userEmail,
      Lead_Source: "ZoKorp Architecture Reviewer",
      Description:
        `Provider: ${lead.architectureProvider}; Score: ${lead.overallScore}; Created: ${lead.createdAt.toISOString()}; ` +
        `TopIssues: ${lead.topIssues}; AuthProvider: ${lead.authProvider ?? "unknown"}; ` +
        `WorkDrive: ${lead.workdriveUploadStatus ?? "n/a"}`,
    }));

    const requestBody = JSON.stringify({
      data,
      duplicate_check_fields: ["Email"],
    });

    async function sendUpsertRequest(token: string) {
      const response = await fetch(`${zohoBase}/crm/v8/Leads`, {
        method: "POST",
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          "Content-Type": "application/json",
        },
        body: requestBody,
      });

      const body = (await response.json()) as {
        data?: Array<{
          status?: string;
          code?: string;
          message?: string;
          details?: {
            id?: string;
          };
        }>;
      };

      return { response, body };
    }

    let { response, body } = await sendUpsertRequest(accessToken);
    const needsRetry =
      (!response.ok && hasZohoRefreshCredentials()) ||
      body.data?.some((item) => item.code === "INVALID_TOKEN" || item.code === "INVALID_OAUTHTOKEN");

    if (needsRetry) {
      const refreshed = await refreshZohoAccessToken();
      if (refreshed) {
        accessToken = refreshed;
        const retried = await sendUpsertRequest(accessToken);
        response = retried.response;
        body = retried.body;
      }
    }

    if (!response.ok || !Array.isArray(body.data)) {
      return NextResponse.json(
        {
          error: "Zoho sync call failed.",
          status: response.status,
          body,
        },
        { status: 502 },
      );
    }

    let synced = 0;
    let failed = 0;
    const now = new Date();

    for (let index = 0; index < pendingLeads.length; index += 1) {
      const lead = pendingLeads[index];
      const result = body.data[index];

      if (!result) {
        failed += 1;
        continue;
      }

      const success = result.status?.toLowerCase() === "success" || result.code?.toUpperCase() === "SUCCESS";
      const duplicate = isDuplicateCode(result.code?.toUpperCase());

      if (success || duplicate) {
        synced += 1;
        await db.leadLog.update({
          where: { id: lead.id },
          data: {
            syncedToZohoAt: now,
            zohoRecordId: result.details?.id ?? null,
            zohoSyncError: duplicate ? result.message ?? result.code ?? "DUPLICATE" : null,
          },
        });
      } else {
        failed += 1;
        await db.leadLog.update({
          where: { id: lead.id },
          data: {
            zohoSyncError: result.message ?? result.code ?? "ZOHO_SYNC_FAILED",
          },
        });
      }
    }

    return NextResponse.json({
      status: "ok",
      synced,
      skipped: 0,
      failed,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Zoho sync failed." }, { status: 500 });
  }
}

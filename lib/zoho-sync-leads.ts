import { db } from "@/lib/db";
import { isSchemaDriftError } from "@/lib/db-errors";
import { FetchTimeoutError, fetchWithTimeout } from "@/lib/http";
import { createInternalAuditLog } from "@/lib/internal-route";
import { ensureLeadLogSchemaReady } from "@/lib/lead-log-schema";
import { zohoLeadStatusForStage } from "@/lib/architecture-review/lead";

type ZohoUpsertBody = {
  data?: Array<{
    status?: string;
    code?: string;
    message?: string;
    details?: {
      id?: string;
    };
  }>;
};

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

function zohoResultCodes(body: ZohoUpsertBody | undefined) {
  if (!Array.isArray(body?.data)) {
    return [];
  }

  return body.data.map((item) => item.code ?? item.status ?? "unknown").slice(0, 10);
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

  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${accountsDomain}/oauth/v2/token`,
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

  const rawBody = await response.text();
  let payload: { access_token?: string } = {};

  try {
    payload = JSON.parse(rawBody) as { access_token?: string };
  } catch {
    return null;
  }

  if (!payload.access_token) {
    return null;
  }

  return payload.access_token;
}

export async function runZohoLeadSync() {
  let accessToken = process.env.ZOHO_CRM_ACCESS_TOKEN ?? "";
  if (!accessToken) {
    const refreshed = await refreshZohoAccessToken();
    if (refreshed) {
      accessToken = refreshed;
    }
  }

  if (!accessToken) {
    await createInternalAuditLog("internal.zoho_sync_leads.not_ready");
    return {
      status: "not_configured" as const,
      error: "Zoho sync is not configured.",
    };
  }

  const zohoBase = process.env.ZOHO_CRM_API_DOMAIN ?? "https://www.zohoapis.com";

  try {
    const leadSchemaReady = await ensureLeadLogSchemaReady();
    if (!leadSchemaReady) {
      await createInternalAuditLog("internal.zoho_sync_leads.schema_unavailable");
      return {
        status: "schema_unavailable" as const,
        error: "Zoho sync is unavailable.",
      };
    }

    const pendingLeads = await (async () => {
      try {
        return await db.leadLog.findMany({
          where: {
            allowCrmFollowUp: true,
            OR: [{ syncedToZohoAt: null }, { zohoSyncNeedsUpdate: true }],
          },
          orderBy: { createdAt: "asc" },
          take: 100,
          select: {
            id: true,
            userEmail: true,
            userName: true,
            architectureProvider: true,
            overallScore: true,
            analysisConfidence: true,
            quoteTier: true,
            emailDeliveryMode: true,
            leadStage: true,
            leadScore: true,
            utmSource: true,
            utmMedium: true,
            utmCampaign: true,
            landingPage: true,
            referrer: true,
            ctaClicks: true,
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
          analysisConfidence: null,
          quoteTier: null,
          emailDeliveryMode: null,
          leadStage: "New Review",
          leadScore: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          landingPage: null,
          referrer: null,
          ctaClicks: 0,
        }));
      }
    })();

    if (pendingLeads.length === 0) {
      return {
        status: "ok" as const,
        synced: 0,
        skipped: 0,
        failed: 0,
        message: "No new leads.",
      };
    }

    const data = pendingLeads.map((lead) => ({
      Last_Name: normalizeLastName({ email: lead.userEmail, userName: lead.userName }),
      Company: normalizeCompanyFromEmail(lead.userEmail),
      Email: lead.userEmail,
      Lead_Source: "ZoKorp Architecture Reviewer",
      Description:
        `ZoKorpLeadKey: ${lead.id}; Provider: ${lead.architectureProvider}; Score: ${lead.overallScore}; Created: ${lead.createdAt.toISOString()}; ` +
        `Confidence: ${lead.analysisConfidence ?? "n/a"}; QuoteTier: ${lead.quoteTier ?? "n/a"}; ` +
        `DeliveryMode: ${lead.emailDeliveryMode ?? "n/a"}; LeadStage: ${lead.leadStage ?? "New Review"}; LeadScore: ${lead.leadScore ?? "n/a"}; ` +
        `CTAclicks: ${lead.ctaClicks ?? 0}; TopIssues: ${lead.topIssues}; AuthProvider: ${lead.authProvider ?? "unknown"}; ` +
        `UTM: ${lead.utmSource ?? "na"}/${lead.utmMedium ?? "na"}/${lead.utmCampaign ?? "na"}; LandingPage: ${lead.landingPage ?? "na"}; Referrer: ${lead.referrer ?? "na"}; ` +
        `WorkDrive: ${lead.workdriveUploadStatus ?? "n/a"}`,
      Lead_Status: zohoLeadStatusForStage(
        (lead.leadStage as "New Review" | "Email Sent" | "CTA Clicked" | "Call Booked" | null) ??
          null,
      ),
    }));

    const requestBody = JSON.stringify({
      data,
      duplicate_check_fields: ["Email"],
    });

    async function sendUpsertRequest(token: string) {
      const response = await fetchWithTimeout(
        `${zohoBase}/crm/v8/Leads`,
        {
          method: "POST",
          headers: {
            Authorization: `Zoho-oauthtoken ${token}`,
            "Content-Type": "application/json",
          },
          body: requestBody,
        },
        15_000,
      );

      const rawBody = await response.text();
      let body: ZohoUpsertBody = {};

      try {
        body = JSON.parse(rawBody) as ZohoUpsertBody;
      } catch {
        body = {};
      }

      return { response, body };
    }

    let response: Response;
    let body: ZohoUpsertBody;

    try {
      const initial = await sendUpsertRequest(accessToken);
      response = initial.response;
      body = initial.body;
    } catch (error) {
      if (error instanceof FetchTimeoutError) {
        await createInternalAuditLog("internal.zoho_sync_leads.timeout", {
          stage: "initial_request",
        });
        return {
          status: "timeout" as const,
          error: "Zoho sync timed out.",
        };
      }

      console.error("zoho sync request failed before response", error);
      await createInternalAuditLog("internal.zoho_sync_leads.request_failed", {
        stage: "initial_request",
        errorName: error instanceof Error ? error.name : "unknown_error",
      });
      return {
        status: "request_failed" as const,
        error: "Zoho sync request failed.",
      };
    }

    const needsRetry =
      (!response.ok && hasZohoRefreshCredentials()) ||
      body.data?.some((item) => item.code === "INVALID_TOKEN" || item.code === "INVALID_OAUTHTOKEN");

    if (needsRetry) {
      const refreshed = await refreshZohoAccessToken();
      if (refreshed) {
        accessToken = refreshed;
        try {
          const retried = await sendUpsertRequest(accessToken);
          response = retried.response;
          body = retried.body;
        } catch (error) {
          if (error instanceof FetchTimeoutError) {
            await createInternalAuditLog("internal.zoho_sync_leads.timeout", {
              stage: "retry_request",
            });
            return {
              status: "timeout" as const,
              error: "Zoho sync retry timed out.",
            };
          }

          console.error("zoho sync retry failed before response", error);
          await createInternalAuditLog("internal.zoho_sync_leads.request_failed", {
            stage: "retry_request",
            errorName: error instanceof Error ? error.name : "unknown_error",
          });
          return {
            status: "request_failed" as const,
            error: "Zoho sync retry failed.",
          };
        }
      }
    }

    if (!response.ok || !Array.isArray(body.data)) {
      console.error("zoho sync upstream call failed", {
        status: response.status,
        resultCodes: zohoResultCodes(body),
      });
      await createInternalAuditLog("internal.zoho_sync_leads.upstream_failed", {
        status: response.status,
        resultCodes: zohoResultCodes(body),
      });
      return {
        status: "upstream_failed" as const,
        error: "Zoho sync call failed.",
      };
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

      const success =
        result.status?.toLowerCase() === "success" || result.code?.toUpperCase() === "SUCCESS";
      const duplicate = isDuplicateCode(result.code?.toUpperCase());

      if (success || duplicate) {
        synced += 1;
        await db.leadLog.update({
          where: { id: lead.id },
          data: {
            syncedToZohoAt: now,
            zohoRecordId: result.details?.id ?? null,
            zohoSyncError: duplicate ? result.message ?? result.code ?? "DUPLICATE" : null,
            zohoSyncNeedsUpdate: false,
          },
        });
      } else {
        failed += 1;
        await db.leadLog.update({
          where: { id: lead.id },
          data: {
            zohoSyncError: result.message ?? result.code ?? "ZOHO_SYNC_FAILED",
            zohoSyncNeedsUpdate: true,
          },
        });
      }
    }

    await createInternalAuditLog("internal.zoho_sync_leads.run", {
      attempted: pendingLeads.length,
      synced,
      failed,
    });

    return {
      status: "ok" as const,
      synced,
      skipped: 0,
      failed,
    };
  } catch (error) {
    console.error("zoho sync failed", error);
    await createInternalAuditLog("internal.zoho_sync_leads.failed", {
      errorName: error instanceof Error ? error.name : "unknown_error",
    });
    return {
      status: "failed" as const,
      error: "Zoho sync failed.",
    };
  }
}

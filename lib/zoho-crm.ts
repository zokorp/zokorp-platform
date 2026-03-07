import { FetchTimeoutError, fetchWithTimeout, readResponseBodySnippet } from "@/lib/http";

type ZohoLeadUpsertInput = {
  email: string;
  fullName: string;
  companyName: string;
  website?: string;
  roleTitle?: string;
  leadSource: string;
  description: string;
};

type ZohoLeadUpsertResult =
  | {
      status: "success" | "duplicate";
      recordId?: string | null;
      error?: string | null;
    }
  | {
      status: "not_configured";
      error: string;
    }
  | {
      status: "failed";
      error: string;
    };

function hasZohoRefreshCredentials() {
  return (
    Boolean(process.env.ZOHO_CRM_REFRESH_TOKEN) &&
    Boolean(process.env.ZOHO_CLIENT_ID) &&
    Boolean(process.env.ZOHO_CLIENT_SECRET)
  );
}

function normalizeLastName(input: { fullName: string; email: string }) {
  const parts = input.fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 0) {
    return parts.at(-1)?.slice(0, 80) ?? "Lead";
  }

  return input.email.split("@")[0]?.slice(0, 80) || "Lead";
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

  try {
    const response = await fetchWithTimeout(
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

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { access_token?: string };
    return payload.access_token ?? null;
  } catch {
    return null;
  }
}

function isDuplicateCode(code?: string) {
  return code === "DUPLICATE_DATA" || code === "DUPLICATE_LINKING_DATA";
}

export async function upsertZohoLead(input: ZohoLeadUpsertInput): Promise<ZohoLeadUpsertResult> {
  let accessToken = process.env.ZOHO_CRM_ACCESS_TOKEN ?? "";
  if (!accessToken) {
    const refreshed = await refreshZohoAccessToken();
    if (refreshed) {
      accessToken = refreshed;
    }
  }

  if (!accessToken) {
    return {
      status: "not_configured",
      error: "ZOHO_CRM_ACCESS_TOKEN_MISSING",
    };
  }

  const zohoBase = process.env.ZOHO_CRM_API_DOMAIN ?? "https://www.zohoapis.com";
  const requestBody = JSON.stringify({
    data: [
      {
        Last_Name: normalizeLastName({ fullName: input.fullName, email: input.email }),
        Company: input.companyName.slice(0, 200),
        Email: input.email,
        Website: input.website?.slice(0, 240),
        Designation: input.roleTitle?.slice(0, 120),
        Lead_Source: input.leadSource,
        Description: input.description.slice(0, 1900),
      },
    ],
    duplicate_check_fields: ["Email"],
  });

  async function sendRequest(token: string) {
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
    let body: {
      data?: Array<{
        status?: string;
        code?: string;
        message?: string;
        details?: {
          id?: string;
        };
      }>;
      rawBody?: string;
    } = {};

    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      body = {
        rawBody: readResponseBodySnippet(rawBody, 1200),
      };
    }

    return { response, body };
  }

  try {
    let result = await sendRequest(accessToken);

    const needsRetry =
      (!result.response.ok && hasZohoRefreshCredentials()) ||
      result.body.data?.some((item) => item.code === "INVALID_TOKEN" || item.code === "INVALID_OAUTHTOKEN");

    if (needsRetry) {
      const refreshed = await refreshZohoAccessToken();
      if (refreshed) {
        accessToken = refreshed;
        result = await sendRequest(accessToken);
      }
    }

    if (!result.response.ok || !Array.isArray(result.body.data) || result.body.data.length === 0) {
      return {
        status: "failed",
        error: `ZOHO_CRM_CALL_FAILED:${result.response.status}`,
      };
    }

    const leadResult = result.body.data[0];
    const success =
      leadResult.status?.toLowerCase() === "success" || leadResult.code?.toUpperCase() === "SUCCESS";

    if (success) {
      return {
        status: "success",
        recordId: leadResult.details?.id ?? null,
        error: null,
      };
    }

    if (isDuplicateCode(leadResult.code?.toUpperCase())) {
      return {
        status: "duplicate",
        recordId: leadResult.details?.id ?? null,
        error: leadResult.message ?? leadResult.code ?? null,
      };
    }

    return {
      status: "failed",
      error: leadResult.message ?? leadResult.code ?? "ZOHO_CRM_UPSERT_FAILED",
    };
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      return {
        status: "failed",
        error: "ZOHO_CRM_TIMEOUT",
      };
    }

    return {
      status: "failed",
      error: error instanceof Error ? error.message : "ZOHO_CRM_UNKNOWN_ERROR",
    };
  }
}

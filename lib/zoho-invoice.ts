import { FetchTimeoutError, fetchWithTimeout, readResponseBodySnippet } from "@/lib/http";

type RuntimeEnv = Record<string, string | undefined>;

export type ZohoInvoiceEstimateLineItem = {
  name: string;
  description?: string | null;
  rate: number;
  quantity?: number;
};

export type ZohoInvoiceEstimateInput = {
  email: string;
  fullName?: string | null;
  companyName?: string | null;
  serviceLabel: string;
  referenceNumber: string;
  lineItems: ZohoInvoiceEstimateLineItem[];
  notes?: string[];
  terms?: string[];
  expirationDays?: number;
};

export type ZohoEstimateCompanionInput = {
  customerEmail: string;
  customerName?: string | null;
  companyName?: string | null;
  sourceLabel: string;
  referenceCode: string;
  notes?: string[];
  lineItems: Array<{
    name: string;
    description?: string | null;
    amountUsd: number;
    quantity?: number;
  }>;
};

export type ZohoInvoiceCredentialSource = "invoice" | "crm";

export type ZohoInvoiceRuntimeConfig = {
  organizationId: string;
  apiDomain: string;
  accountsDomain: string;
  accessToken: string;
  accessTokenSource: ZohoInvoiceCredentialSource | null;
  refreshToken: string;
  refreshTokenSource: ZohoInvoiceCredentialSource | null;
  clientId: string;
  clientSecret: string;
  isConfigured: boolean;
};

export type ZohoInvoiceEstimateResult =
  | {
      ok: true;
      status: "created";
      provider: "zoho-invoice";
      contactId: string | null;
      estimateId: string;
      estimateNumber: string | null;
      referenceNumber: string;
    }
  | {
      ok: false;
      status: "not_configured" | "failed" | "timeout";
      provider: "zoho-invoice" | null;
      error: string;
      referenceNumber: string;
      contactId?: string | null;
      estimateId?: string | null;
    };

export type ZohoInvoiceEstimateSnapshotResult =
  | {
      ok: true;
      status: "ok";
      provider: "zoho-invoice";
      estimateId: string;
      estimateNumber: string | null;
      referenceNumber: string | null;
      estimateStatus: string | null;
      lastModifiedTime: string | null;
      isViewedByClient: boolean | null;
      externalUrl: string | null;
    }
  | {
      ok: false;
      status: "not_configured" | "failed" | "timeout";
      provider: "zoho-invoice" | null;
      estimateId: string;
      error: string;
    };

type ZohoContact = {
  contact_id?: string;
  email?: string;
  contact_name?: string;
  contact_persons?: Array<{
    email?: string;
    is_primary_contact?: boolean;
  }>;
};

function envValue(env: RuntimeEnv, key: string) {
  return env[key]?.trim() ?? "";
}

export function resolveZohoInvoiceRuntimeConfig(env: RuntimeEnv = process.env): ZohoInvoiceRuntimeConfig {
  const organizationId = envValue(env, "ZOHO_INVOICE_ORGANIZATION_ID");
  const apiDomain = envValue(env, "ZOHO_INVOICE_API_DOMAIN") || "https://www.zohoapis.com";
  const accountsDomain = envValue(env, "ZOHO_INVOICE_ACCOUNTS_DOMAIN") || envValue(env, "ZOHO_ACCOUNTS_DOMAIN") || "https://accounts.zoho.com";
  const invoiceAccessToken = envValue(env, "ZOHO_INVOICE_ACCESS_TOKEN");
  const crmAccessToken = envValue(env, "ZOHO_CRM_ACCESS_TOKEN");
  const accessToken = invoiceAccessToken || crmAccessToken;
  const accessTokenSource = invoiceAccessToken ? "invoice" : crmAccessToken ? "crm" : null;
  const invoiceRefreshToken = envValue(env, "ZOHO_INVOICE_REFRESH_TOKEN");
  const crmRefreshToken = envValue(env, "ZOHO_CRM_REFRESH_TOKEN");
  const invoiceClientId = envValue(env, "ZOHO_INVOICE_CLIENT_ID");
  const crmClientId = envValue(env, "ZOHO_CLIENT_ID");
  const invoiceClientSecret = envValue(env, "ZOHO_INVOICE_CLIENT_SECRET");
  const crmClientSecret = envValue(env, "ZOHO_CLIENT_SECRET");
  const refreshToken = invoiceRefreshToken || crmRefreshToken;
  const clientId = invoiceClientId || crmClientId;
  const clientSecret = invoiceClientSecret || crmClientSecret;
  const refreshTokenSource = refreshToken && clientId && clientSecret ? (invoiceRefreshToken ? "invoice" : "crm") : null;

  return {
    organizationId,
    apiDomain,
    accountsDomain,
    accessToken,
    accessTokenSource,
    refreshToken,
    refreshTokenSource,
    clientId,
    clientSecret,
    isConfigured: Boolean(organizationId && (accessToken || refreshTokenSource)),
  };
}

function zohoInvoiceOrganizationId(env: RuntimeEnv = process.env) {
  return resolveZohoInvoiceRuntimeConfig(env).organizationId;
}

function zohoInvoiceApiDomain(env: RuntimeEnv = process.env) {
  return resolveZohoInvoiceRuntimeConfig(env).apiDomain;
}

function zohoInvoiceAccountsDomain(env: RuntimeEnv = process.env) {
  return resolveZohoInvoiceRuntimeConfig(env).accountsDomain;
}

function directInvoiceAccessToken(env: RuntimeEnv = process.env) {
  return envValue(env, "ZOHO_INVOICE_ACCESS_TOKEN");
}

function directCrmAccessToken(env: RuntimeEnv = process.env) {
  return envValue(env, "ZOHO_CRM_ACCESS_TOKEN");
}

function hasDedicatedInvoiceRefreshCredentials(env: RuntimeEnv = process.env) {
  return Boolean(
    envValue(env, "ZOHO_INVOICE_REFRESH_TOKEN") &&
      envValue(env, "ZOHO_INVOICE_CLIENT_ID") &&
      envValue(env, "ZOHO_INVOICE_CLIENT_SECRET"),
  );
}

function hasZohoInvoiceRefreshCredentials(env: RuntimeEnv = process.env) {
  return resolveZohoInvoiceRuntimeConfig(env).refreshTokenSource !== null;
}

export function isZohoInvoiceConfigured(env: RuntimeEnv = process.env) {
  return resolveZohoInvoiceRuntimeConfig(env).isConfigured;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function splitName(fullName: string | null | undefined, email: string) {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) {
    const fallback = email.split("@")[0]?.slice(0, 80) || "ZoKorp";
    return {
      firstName: fallback,
      lastName: "Customer",
    };
  }

  return {
    firstName: parts[0]?.slice(0, 80) || "ZoKorp",
    lastName: (parts.slice(1).join(" ") || parts[0] || "Customer").slice(0, 80),
  };
}

function deriveCompanyName(email: string, explicitCompanyName?: string | null) {
  if (explicitCompanyName?.trim()) {
    return explicitCompanyName.trim().slice(0, 120);
  }

  const domain = normalizeEmail(email).split("@")[1] ?? "customer";
  const company = domain.split(".")[0]?.replace(/[-_]+/g, " ") || "customer";
  return company.replace(/\b\w/g, (char) => char.toUpperCase()).slice(0, 120);
}

async function refreshZohoInvoiceAccessToken() {
  if (!hasZohoInvoiceRefreshCredentials()) {
    return null;
  }
  const config = resolveZohoInvoiceRuntimeConfig();

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: config.refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetchWithTimeout(
    `${zohoInvoiceAccountsDomain()}/oauth/v2/token`,
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
  return payload.access_token?.trim() || null;
}

async function getZohoInvoiceBearerToken() {
  const invoiceDirect = directInvoiceAccessToken();
  if (invoiceDirect) {
    return invoiceDirect;
  }

  if (hasDedicatedInvoiceRefreshCredentials()) {
    const refreshed = await refreshZohoInvoiceAccessToken();
    if (refreshed) {
      return refreshed;
    }
  }

  const crmDirect = directCrmAccessToken();
  if (crmDirect) {
    return crmDirect;
  }

  return await refreshZohoInvoiceAccessToken();
}

function invoiceHeaders(token: string) {
  return {
    Authorization: `Zoho-oauthtoken ${token}`,
    "Content-Type": "application/json",
    "X-com-zoho-invoice-organizationid": zohoInvoiceOrganizationId(),
  };
}

function exactContactEmailMatch(contact: ZohoContact, email: string) {
  const normalizedTarget = normalizeEmail(email);
  if (normalizeEmail(contact.email ?? "") === normalizedTarget) {
    return true;
  }

  return (contact.contact_persons ?? []).some((person) => normalizeEmail(person.email ?? "") === normalizedTarget);
}

async function findZohoInvoiceContactByEmail(token: string, email: string) {
  const query = new URLSearchParams({
    organization_id: zohoInvoiceOrganizationId(),
    email_contains: email,
  });

  const response = await fetchWithTimeout(
    `${zohoInvoiceApiDomain()}/invoice/v3/contacts?${query.toString()}`,
    {
      method: "GET",
      headers: invoiceHeaders(token),
    },
    10_000,
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { contacts?: ZohoContact[] };
  return payload.contacts?.find((contact) => exactContactEmailMatch(contact, email)) ?? null;
}

async function createZohoInvoiceContact(
  token: string,
  input: Pick<ZohoInvoiceEstimateInput, "email" | "fullName" | "companyName">,
) {
  const { firstName, lastName } = splitName(input.fullName, input.email);
  const companyName = deriveCompanyName(input.email, input.companyName);
  const payload = {
    contact_name: companyName,
    company_name: companyName,
    contact_type: "customer",
    contact_persons: [
      {
        first_name: firstName,
        last_name: lastName,
        email: input.email,
        is_primary_contact: true,
      },
    ],
  };

  const response = await fetchWithTimeout(
    `${zohoInvoiceApiDomain()}/invoice/v3/contacts?organization_id=${encodeURIComponent(zohoInvoiceOrganizationId())}`,
    {
      method: "POST",
      headers: invoiceHeaders(token),
      body: JSON.stringify(payload),
    },
    12_000,
  );

  const rawBody = await response.text();
  if (!response.ok) {
    return {
      ok: false as const,
      error: `ZOHO_INVOICE_CONTACT_${response.status}:${readResponseBodySnippet(rawBody, 600)}`,
    };
  }

  const body = JSON.parse(rawBody) as { contact?: ZohoContact };
  return {
    ok: true as const,
    contact: body.contact ?? null,
  };
}

async function ensureZohoInvoiceContact(
  token: string,
  input: Pick<ZohoInvoiceEstimateInput, "email" | "fullName" | "companyName">,
) {
  const existing = await findZohoInvoiceContactByEmail(token, input.email);
  if (existing?.contact_id) {
    return {
      ok: true as const,
      contactId: existing.contact_id,
    };
  }

  const created = await createZohoInvoiceContact(token, input);
  if (created.ok && created.contact?.contact_id) {
    return {
      ok: true as const,
      contactId: created.contact.contact_id,
    };
  }

  const retryExisting = await findZohoInvoiceContactByEmail(token, input.email);
  if (retryExisting?.contact_id) {
    return {
      ok: true as const,
      contactId: retryExisting.contact_id,
    };
  }

  return {
    ok: false as const,
    error: created.ok ? "ZOHO_INVOICE_CONTACT_ID_MISSING" : created.error,
  };
}

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function sanitizeLineItems(items: ZohoInvoiceEstimateLineItem[]) {
  return items
    .filter((item) => Number.isFinite(item.rate) && item.rate > 0)
    .map((item) => ({
      name: item.name.trim().slice(0, 100),
      description: item.description?.trim().slice(0, 2000) || undefined,
      rate: Math.round(item.rate),
      quantity: Math.max(1, Math.round(item.quantity ?? 1)),
    }));
}

export async function syncZohoInvoiceEstimate(input: ZohoInvoiceEstimateInput): Promise<ZohoInvoiceEstimateResult> {
  if (!isZohoInvoiceConfigured()) {
    return {
      ok: false,
      status: "not_configured",
      provider: null,
      error: "ZOHO_INVOICE_NOT_CONFIGURED",
      referenceNumber: input.referenceNumber,
    };
  }

  const lineItems = sanitizeLineItems(input.lineItems);
  if (lineItems.length === 0) {
    return {
      ok: false,
      status: "failed",
      provider: "zoho-invoice",
      error: "ZOHO_INVOICE_LINE_ITEMS_MISSING",
      referenceNumber: input.referenceNumber,
    };
  }

  try {
    const token = await getZohoInvoiceBearerToken();
    if (!token) {
      return {
        ok: false,
        status: "not_configured",
        provider: null,
        error: "ZOHO_INVOICE_ACCESS_TOKEN_MISSING",
        referenceNumber: input.referenceNumber,
      };
    }

    const contact = await ensureZohoInvoiceContact(token, input);
    if (!contact.ok) {
      return {
        ok: false,
        status: "failed",
        provider: "zoho-invoice",
        error: contact.error,
        referenceNumber: input.referenceNumber,
      };
    }

    const response = await fetchWithTimeout(
      `${zohoInvoiceApiDomain()}/invoice/v3/estimates?organization_id=${encodeURIComponent(zohoInvoiceOrganizationId())}`,
      {
        method: "POST",
        headers: invoiceHeaders(token),
        body: JSON.stringify({
          customer_id: contact.contactId,
          reference_number: input.referenceNumber,
          estimate_number: input.referenceNumber,
          date: isoDate(),
          expiry_date: isoDate(Math.max(1, input.expirationDays ?? 7)),
          line_items: lineItems,
          notes: input.notes?.filter(Boolean).join("\n") || undefined,
          terms: input.terms?.filter(Boolean).join("\n") || undefined,
          custom_fields: [],
        }),
      },
      12_000,
    );

    const rawBody = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        provider: "zoho-invoice",
        error: `ZOHO_INVOICE_ESTIMATE_${response.status}:${readResponseBodySnippet(rawBody, 800)}`,
        referenceNumber: input.referenceNumber,
        contactId: contact.contactId,
      };
    }

    const payload = JSON.parse(rawBody) as {
      estimate?: {
        estimate_id?: string;
        estimate_number?: string;
        reference_number?: string;
      };
      estimates?: Array<{
        estimate_id?: string;
        estimate_number?: string;
        reference_number?: string;
      }>;
    };

    const estimate = payload.estimate ?? payload.estimates?.[0] ?? null;
    const estimateId = estimate?.estimate_id?.trim() || "";
    if (!estimateId) {
      return {
        ok: false,
        status: "failed",
        provider: "zoho-invoice",
        error: "ZOHO_INVOICE_ESTIMATE_ID_MISSING",
        referenceNumber: input.referenceNumber,
        contactId: contact.contactId,
      };
    }

    return {
      ok: true,
      status: "created",
      provider: "zoho-invoice",
      contactId: contact.contactId,
      estimateId,
      estimateNumber: estimate?.estimate_number?.trim() || null,
      referenceNumber: estimate?.reference_number?.trim() || input.referenceNumber,
    };
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      return {
        ok: false,
        status: "timeout",
        provider: "zoho-invoice",
        error: "ZOHO_INVOICE_TIMEOUT",
        referenceNumber: input.referenceNumber,
      };
    }

    return {
      ok: false,
      status: "failed",
      provider: "zoho-invoice",
      error: error instanceof Error ? error.message : "ZOHO_INVOICE_UNKNOWN_ERROR",
      referenceNumber: input.referenceNumber,
    };
  }
}

export async function fetchZohoInvoiceEstimateSnapshot(input: {
  estimateId: string;
}): Promise<ZohoInvoiceEstimateSnapshotResult> {
  if (!isZohoInvoiceConfigured()) {
    return {
      ok: false,
      status: "not_configured",
      provider: null,
      estimateId: input.estimateId,
      error: "ZOHO_INVOICE_NOT_CONFIGURED",
    };
  }

  try {
    const token = await getZohoInvoiceBearerToken();
    if (!token) {
      return {
        ok: false,
        status: "not_configured",
        provider: null,
        estimateId: input.estimateId,
        error: "ZOHO_INVOICE_ACCESS_TOKEN_MISSING",
      };
    }

    const response = await fetchWithTimeout(
      `${zohoInvoiceApiDomain()}/invoice/v3/estimates/${encodeURIComponent(input.estimateId)}?organization_id=${encodeURIComponent(zohoInvoiceOrganizationId())}`,
      {
        method: "GET",
        headers: invoiceHeaders(token),
      },
      12_000,
    );

    const rawBody = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        provider: "zoho-invoice",
        estimateId: input.estimateId,
        error: `ZOHO_INVOICE_ESTIMATE_FETCH_${response.status}:${readResponseBodySnippet(rawBody, 800)}`,
      };
    }

    const payload = JSON.parse(rawBody) as {
      estimate?: {
        estimate_id?: string;
        estimate_number?: string;
        reference_number?: string;
        status?: string;
        estimate_status?: string;
        last_modified_time?: string;
        is_viewed_by_client?: boolean;
        url?: string;
        estimate_url?: string;
      };
    };

    const estimate = payload.estimate ?? {};

    return {
      ok: true,
      status: "ok",
      provider: "zoho-invoice",
      estimateId: estimate.estimate_id?.trim() || input.estimateId,
      estimateNumber: estimate.estimate_number?.trim() || null,
      referenceNumber: estimate.reference_number?.trim() || null,
      estimateStatus: estimate.status?.trim() || estimate.estimate_status?.trim() || null,
      lastModifiedTime: estimate.last_modified_time?.trim() || null,
      isViewedByClient: typeof estimate.is_viewed_by_client === "boolean" ? estimate.is_viewed_by_client : null,
      externalUrl: estimate.estimate_url?.trim() || estimate.url?.trim() || null,
    };
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      return {
        ok: false,
        status: "timeout",
        provider: "zoho-invoice",
        estimateId: input.estimateId,
        error: "ZOHO_INVOICE_TIMEOUT",
      };
    }

    return {
      ok: false,
      status: "failed",
      provider: "zoho-invoice",
      estimateId: input.estimateId,
      error: error instanceof Error ? error.message : "ZOHO_INVOICE_UNKNOWN_ERROR",
    };
  }
}

export async function createZohoEstimateCompanion(input: ZohoEstimateCompanionInput) {
  const notes = [input.sourceLabel, ...(input.notes ?? [])];

  return syncZohoInvoiceEstimate({
    email: input.customerEmail,
    fullName: input.customerName ?? null,
    companyName: input.companyName ?? null,
    serviceLabel: input.sourceLabel,
    referenceNumber: input.referenceCode,
    notes,
    terms: [
      "This companion estimate is generated from ZoKorp platform findings and remains subject to final delivery confirmation.",
    ],
    lineItems: input.lineItems.map((lineItem) => ({
      name: lineItem.name,
      description: lineItem.description ?? undefined,
      rate: lineItem.amountUsd,
      quantity: lineItem.quantity ?? 1,
    })),
  });
}

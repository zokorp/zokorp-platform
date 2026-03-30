import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithTimeoutMock, readResponseBodySnippetMock } = vi.hoisted(() => ({
  fetchWithTimeoutMock: vi.fn(),
  readResponseBodySnippetMock: vi.fn((value: string) => value),
}));

vi.mock("@/lib/http", () => ({
  FetchTimeoutError: class extends Error {},
  fetchWithTimeout: fetchWithTimeoutMock,
  readResponseBodySnippet: readResponseBodySnippetMock,
}));

import { isZohoInvoiceConfigured, syncZohoInvoiceEstimate } from "@/lib/zoho-invoice";

describe("zoho invoice estimate sync", () => {
  const originalEnv = {
    ZOHO_INVOICE_ORGANIZATION_ID: process.env.ZOHO_INVOICE_ORGANIZATION_ID,
    ZOHO_INVOICE_ACCESS_TOKEN: process.env.ZOHO_INVOICE_ACCESS_TOKEN,
    ZOHO_CRM_ACCESS_TOKEN: process.env.ZOHO_CRM_ACCESS_TOKEN,
    ZOHO_INVOICE_API_DOMAIN: process.env.ZOHO_INVOICE_API_DOMAIN,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ZOHO_INVOICE_API_DOMAIN = "https://www.zohoapis.com";
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("returns not configured when organization and credentials are missing", async () => {
    delete process.env.ZOHO_INVOICE_ORGANIZATION_ID;
    delete process.env.ZOHO_INVOICE_ACCESS_TOKEN;

    const result = await syncZohoInvoiceEstimate({
      email: "owner@acmecloud.com",
      serviceLabel: "Validator remediation estimate",
      referenceNumber: "REF-123",
      lineItems: [{ name: "Remediation", rate: 625 }],
    });

    expect(result).toEqual({
      ok: false,
      status: "not_configured",
      error: "ZOHO_INVOICE_NOT_CONFIGURED",
      provider: null,
      referenceNumber: "REF-123",
    });
    expect(fetchWithTimeoutMock).not.toHaveBeenCalled();
  });

  it("creates an estimate when Zoho Invoice is configured", async () => {
    process.env.ZOHO_INVOICE_ORGANIZATION_ID = "org_123";
    process.env.ZOHO_INVOICE_ACCESS_TOKEN = "token_123";

    fetchWithTimeoutMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: [{ contact_id: "contact_123", email: "owner@acmecloud.com" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            estimate: {
              estimate_id: "estimate_123",
              estimate_number: "EST-000123",
              reference_number: "REF-123",
            },
          }),
      });

    const result = await syncZohoInvoiceEstimate({
      email: "owner@acmecloud.com",
      fullName: "Owner Example",
      companyName: "Acme Cloud",
      serviceLabel: "Validator remediation estimate",
      referenceNumber: "REF-123",
      lineItems: [{ name: "Remediation", rate: 625 }],
      notes: ["Score: 92%"],
    });

    expect(result).toEqual({
      ok: true,
      status: "created",
      contactId: "contact_123",
      estimateId: "estimate_123",
      estimateNumber: "EST-000123",
      provider: "zoho-invoice",
      referenceNumber: "REF-123",
    });
    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(2);
  });

  it("accepts CRM fallback credentials when invoice-specific credentials are absent", async () => {
    process.env.ZOHO_INVOICE_ORGANIZATION_ID = "org_123";
    delete process.env.ZOHO_INVOICE_ACCESS_TOKEN;
    process.env.ZOHO_CRM_ACCESS_TOKEN = "crm-token_123";

    expect(isZohoInvoiceConfigured()).toBe(true);

    fetchWithTimeoutMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: [{ contact_id: "contact_123", email: "owner@acmecloud.com" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            estimate: {
              estimate_id: "estimate_456",
              estimate_number: "EST-000456",
              reference_number: "REF-CRM-123",
            },
          }),
      });

    const result = await syncZohoInvoiceEstimate({
      email: "owner@acmecloud.com",
      fullName: "Owner Example",
      companyName: "Acme Cloud",
      serviceLabel: "Validator remediation estimate",
      referenceNumber: "REF-CRM-123",
      lineItems: [{ name: "Remediation", rate: 625 }],
    });

    expect(result).toEqual({
      ok: true,
      status: "created",
      contactId: "contact_123",
      estimateId: "estimate_456",
      estimateNumber: "EST-000456",
      provider: "zoho-invoice",
      referenceNumber: "REF-CRM-123",
    });
  });
});

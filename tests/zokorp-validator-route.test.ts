import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const {
  requireSameOriginMock,
  consumeRateLimitMock,
  getRequestFingerprintMock,
  requireUserMock,
  requireEntitlementMock,
  decrementUsesAtomicallyMock,
  parseValidatorInputMock,
  buildUniqueEstimateReferenceCodeMock,
  buildValidatorEstimateMock,
  buildValidatorEmailContentMock,
  sendValidatorResultsEmailMock,
  recordEstimateCompanionMock,
  syncZohoInvoiceEstimateMock,
  getValidatorTargetOptionsMock,
  resolveValidatorTargetContextMock,
  entitlementFindFirstMock,
  creditBalanceFindManyMock,
  auditCreateMock,
} = vi.hoisted(() => ({
  requireSameOriginMock: vi.fn(),
  consumeRateLimitMock: vi.fn(),
  getRequestFingerprintMock: vi.fn(),
  requireUserMock: vi.fn(),
  requireEntitlementMock: vi.fn(),
  decrementUsesAtomicallyMock: vi.fn(),
  parseValidatorInputMock: vi.fn(),
  buildUniqueEstimateReferenceCodeMock: vi.fn(),
  buildValidatorEstimateMock: vi.fn(),
  buildValidatorEmailContentMock: vi.fn(),
  sendValidatorResultsEmailMock: vi.fn(),
  recordEstimateCompanionMock: vi.fn(),
  syncZohoInvoiceEstimateMock: vi.fn(),
  getValidatorTargetOptionsMock: vi.fn(),
  resolveValidatorTargetContextMock: vi.fn(),
  entitlementFindFirstMock: vi.fn(),
  creditBalanceFindManyMock: vi.fn(),
  auditCreateMock: vi.fn(),
}));

vi.mock("@/lib/request-origin", () => ({
  requireSameOrigin: requireSameOriginMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: consumeRateLimitMock,
  getRequestFingerprint: getRequestFingerprintMock,
}));

vi.mock("@/lib/auth", () => ({
  requireUser: requireUserMock,
}));

vi.mock("@/lib/entitlements", () => ({
  requireEntitlement: requireEntitlementMock,
  decrementUsesAtomically: decrementUsesAtomicallyMock,
}));

vi.mock("@/lib/validator", () => ({
  parseValidatorInput: parseValidatorInputMock,
}));

vi.mock("@/lib/privacy-leads", () => ({
  buildUniqueEstimateReferenceCode: buildUniqueEstimateReferenceCodeMock,
}));

vi.mock("@/lib/validator-delivery", () => ({
  buildValidatorEstimate: buildValidatorEstimateMock,
  buildValidatorEmailContent: buildValidatorEmailContentMock,
  sendValidatorResultsEmail: sendValidatorResultsEmailMock,
}));

vi.mock("@/lib/estimate-companions", () => ({
  recordEstimateCompanion: recordEstimateCompanionMock,
}));

vi.mock("@/lib/zoho-invoice", () => ({
  syncZohoInvoiceEstimate: syncZohoInvoiceEstimateMock,
}));

vi.mock("@/lib/validator-library", () => ({
  getValidatorTargetOptions: getValidatorTargetOptionsMock,
  resolveValidatorTargetContext: resolveValidatorTargetContextMock,
}));

vi.mock("@/lib/db", () => ({
  db: {
    entitlement: {
      findFirst: entitlementFindFirstMock,
    },
    creditBalance: {
      findMany: creditBalanceFindManyMock,
    },
    auditLog: {
      create: auditCreateMock,
    },
  },
}));

import { POST } from "@/app/api/tools/zokorp-validator/route";

describe("zokorp validator route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireSameOriginMock.mockReturnValue(null);
    consumeRateLimitMock.mockResolvedValue({ allowed: true });
    getRequestFingerprintMock.mockReturnValue("fingerprint");
    requireUserMock.mockResolvedValue({
      id: "user_123",
      email: "owner@acmecloud.com",
      name: "Owner",
    });
    requireEntitlementMock.mockResolvedValue({
      productId: "product_validator",
      entitlement: { remainingUses: 8 },
      adminBypass: false,
    });
    decrementUsesAtomicallyMock.mockResolvedValue({
      remainingUses: 6,
    });
    getValidatorTargetOptionsMock.mockReturnValue([]);
    resolveValidatorTargetContextMock.mockReturnValue(undefined);
    parseValidatorInputMock.mockResolvedValue({
      output: "validation output",
      meta: {
        inputType: "pdf",
        profile: "FTR",
        redactions: {
          sensitiveTerms: 0,
          ids: 0,
          emailAddresses: 0,
          phoneNumbers: 0,
          urls: 0,
          addresses: 0,
          names: 0,
          accountNumbers: 0,
          controlReferences: 0,
        },
      },
      report: {
        score: 92,
        rulepack: { id: "rulepack_ftr" },
        controlCalibration: {
          totalControls: 3,
        },
      },
      reviewedWorkbookBase64: "reviewed-base64",
      reviewedWorkbookFileName: "reviewed.xlsx",
      reviewedWorkbookMimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    buildUniqueEstimateReferenceCodeMock.mockReturnValue("ZK-VAL-20260329-ABC123-A1B2");
    buildValidatorEstimateMock.mockReturnValue({
      quoteUsd: 625,
      estimatedHoursTotal: 4.5,
      slaLabel: "2-4 business days",
      summary: "Bounded remediation estimate.",
      nextStep: "Tighten the reviewer-facing evidence and rerun.",
      lineItems: [
        {
          catalogKey: "FTR::scope",
          ruleId: "scope",
          title: "Scope and objectives are defined",
          status: "MISSING",
          severity: "CRITICAL",
          serviceLineLabel: "Gap memo",
          publicFixSummary: "Clarify scope boundaries and objectives.",
          amountUsd: 375,
          estimatedHours: 2.5,
          source: "catalog",
        },
        {
          catalogKey: "FTR::control-row-review",
          ruleId: "control-row-review",
          title: "Control-row rewrite pass",
          status: "PARTIAL",
          severity: "PACKAGE",
          serviceLineLabel: "Rewrite pass",
          publicFixSummary: "Tighten failing row responses.",
          amountUsd: 250,
          estimatedHours: 2,
          source: "package",
        },
      ],
    });
    buildValidatorEmailContentMock.mockReturnValue({
      subject: "Validator result",
      text: "validator text",
      html: "<p>validator html</p>",
    });
    sendValidatorResultsEmailMock.mockResolvedValue({
      ok: true,
      status: "sent",
    });
    recordEstimateCompanionMock.mockResolvedValue({ id: "estimate_companion_123" });
    syncZohoInvoiceEstimateMock.mockResolvedValue({
      ok: true,
      status: "created",
      contactId: "contact_123",
      estimateId: "estimate_123",
      estimateNumber: "EST-000123",
      referenceNumber: "rulepack_ftr",
    });
    entitlementFindFirstMock.mockRejectedValue(new Error("lookup failed"));
    creditBalanceFindManyMock.mockResolvedValue([{ remainingUses: 12 }]);
    auditCreateMock.mockRejectedValue(new Error("audit unavailable"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success even when audit logging and remaining-use refresh fail after decrement", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const formData = new FormData();
    formData.set(
      "file",
      new File([Buffer.from("%PDF-1.4")], "validator-report.pdf", {
        type: "application/pdf",
      }),
    );
    formData.set("validationProfile", "FTR");

    const response = await POST(
      new Request("https://app.zokorp.com/api/tools/zokorp-validator", {
        method: "POST",
        headers: {
          origin: "https://app.zokorp.com",
        },
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      output: "validation output",
      meta: {
        inputType: "pdf",
        profile: "FTR",
        redactions: {
          sensitiveTerms: 0,
          ids: 0,
          emailAddresses: 0,
          phoneNumbers: 0,
          urls: 0,
          addresses: 0,
          names: 0,
          accountNumbers: 0,
          controlReferences: 0,
        },
      },
      report: {
        score: 92,
        rulepack: { id: "rulepack_ftr" },
        controlCalibration: {
          totalControls: 3,
        },
      },
      reviewedWorkbookBase64: "reviewed-base64",
      reviewedWorkbookFileName: "reviewed.xlsx",
      reviewedWorkbookMimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      remainingUses: 6,
      adminBypass: false,
      emailDeliveryStatus: "sent",
      estimate: {
        quoteUsd: 625,
        estimatedHoursTotal: 4.5,
        slaLabel: "2-4 business days",
        summary: "Bounded remediation estimate.",
        nextStep: "Tighten the reviewer-facing evidence and rerun.",
        lineItems: [
          {
            catalogKey: "FTR::scope",
            ruleId: "scope",
            title: "Scope and objectives are defined",
            status: "MISSING",
            severity: "CRITICAL",
            serviceLineLabel: "Gap memo",
            publicFixSummary: "Clarify scope boundaries and objectives.",
            amountUsd: 375,
            estimatedHours: 2.5,
            source: "catalog",
          },
          {
            catalogKey: "FTR::control-row-review",
            ruleId: "control-row-review",
            title: "Control-row rewrite pass",
            status: "PARTIAL",
            severity: "PACKAGE",
            serviceLineLabel: "Rewrite pass",
            publicFixSummary: "Tighten failing row responses.",
            amountUsd: 250,
            estimatedHours: 2,
            source: "package",
          },
        ],
      },
      quoteCompanion: {
        status: "created",
        provider: "zoho-invoice",
        estimateId: "estimate_123",
        estimateNumber: "EST-000123",
      },
    });
    expect(decrementUsesAtomicallyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_123",
        productSlug: "zokorp-validator",
        uses: 1,
        allowGeneralCreditFallback: true,
      }),
    );
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "tool.zokorp_validator_run",
          metadataJson: expect.objectContaining({
            estimateReferenceCode: "ZK-VAL-20260329-ABC123-A1B2",
            deliveryStatus: "sent",
            estimateQuoteUsd: 625,
            estimateHoursTotal: 4.5,
            estimateSla: "2-4 business days",
            quoteCompanionStatus: "created",
            quoteCompanionProvider: "zoho-invoice",
            quoteCompanionReference: "EST-000123",
            quoteCompanionError: null,
          }),
        }),
      }),
    );

    consoleErrorSpy.mockRestore();
  });

  it("marks validation errors as non-cacheable", async () => {
    const formData = new FormData();
    formData.set("validationProfile", "FTR");

    const response = await POST(
      new Request("https://app.zokorp.com/api/tools/zokorp-validator", {
        method: "POST",
        headers: {
          origin: "https://app.zokorp.com",
        },
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "File is required",
    });
  });
});

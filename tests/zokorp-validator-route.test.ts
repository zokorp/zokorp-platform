import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const {
  requireSameOriginMock,
  consumeRateLimitMock,
  getRequestFingerprintMock,
  requireUserMock,
  requireEntitlementMock,
  decrementUsesAtomicallyMock,
  parseValidatorInputMock,
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

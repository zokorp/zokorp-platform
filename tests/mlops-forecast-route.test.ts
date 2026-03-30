import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireSameOriginMock,
  consumeRateLimitMock,
  getRequestFingerprintMock,
  requireUserMock,
  requireEntitlementMock,
  auditCreateMock,
  readXlsxWorkbookRowsMock,
} = vi.hoisted(() => ({
  requireSameOriginMock: vi.fn(),
  consumeRateLimitMock: vi.fn(),
  getRequestFingerprintMock: vi.fn(),
  requireUserMock: vi.fn(),
  requireEntitlementMock: vi.fn(),
  auditCreateMock: vi.fn(),
  readXlsxWorkbookRowsMock: vi.fn(),
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
}));

vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      create: auditCreateMock,
    },
  },
}));

vi.mock("@/lib/workbook", () => ({
  readXlsxWorkbookRows: readXlsxWorkbookRowsMock,
}));

import { POST } from "@/app/api/tools/mlops-forecast/route";

function makeRequest(formData: FormData) {
  return new Request("https://app.zokorp.com/api/tools/mlops-forecast", {
    method: "POST",
    headers: {
      origin: "https://app.zokorp.com",
    },
    body: formData,
  });
}

describe("mlops forecast route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireSameOriginMock.mockReturnValue(null);
    consumeRateLimitMock.mockResolvedValue({
      allowed: true,
      remaining: 19,
      retryAfterSeconds: 0,
    });
    getRequestFingerprintMock.mockReturnValue("fp_123");
    requireUserMock.mockResolvedValue({
      id: "user_123",
      email: "owner@acmecloud.com",
      name: "Owner",
    });
    requireEntitlementMock.mockResolvedValue({
      productId: "product_mlops",
      entitlement: {
        status: "ACTIVE",
      },
      adminBypass: false,
    });
    auditCreateMock.mockResolvedValue({ id: "audit_123" });
    readXlsxWorkbookRowsMock.mockResolvedValue([
      {
        name: "Revenue",
        rows: [
          ["date", "revenue"],
          ["2026-01-01", "1000"],
          ["2026-02-01", "1200"],
          ["2026-03-01", "1350"],
        ],
      },
    ]);
  });

  it("returns a demo forecast without requiring an upload file", async () => {
    const formData = new FormData();
    formData.set("runMode", "demo");

    const response = await POST(makeRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual(
      expect.objectContaining({
        sourceType: "demo",
        sourceName: "Demo revenue series",
        auditId: "audit_123",
        forecastRows: expect.any(Array),
        access: {
          productId: "product_mlops",
          adminBypass: false,
          entitlementActive: true,
        },
      }),
    );
    expect(body.forecastRows).toHaveLength(6);
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "tool.mlops_forecast_run",
          metadataJson: expect.objectContaining({
            demoRun: true,
            sourceType: "demo",
          }),
        }),
      }),
    );
  });

  it("accepts csv uploads and records the source name", async () => {
    const formData = new FormData();
    formData.set("runMode", "upload");
    formData.set(
      "file",
      new File([
        "date,revenue\n2026-01-01,1000\n2026-02-01,1200\n2026-03-01,1350\n",
      ], "revenue.csv", {
        type: "text/csv",
      }),
    );

    const response = await POST(makeRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sourceType).toBe("csv");
    expect(body.sourceName).toBe("revenue.csv");
    expect(body.observations).toBe(3);
    expect(auditCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadataJson: expect.objectContaining({
            demoRun: false,
            sourceType: "csv",
            sourceName: "revenue.csv",
          }),
        }),
      }),
    );
  });

  it("accepts xlsx uploads through the workbook parser", async () => {
    const formData = new FormData();
    formData.set("runMode", "upload");
    formData.set(
      "file",
      new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], "revenue.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );

    const response = await POST(makeRequest(formData));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sourceType).toBe("xlsx");
    expect(body.sourceName).toBe("revenue.xlsx");
    expect(body.observations).toBe(3);
    expect(readXlsxWorkbookRowsMock).toHaveBeenCalledTimes(1);
  });
});

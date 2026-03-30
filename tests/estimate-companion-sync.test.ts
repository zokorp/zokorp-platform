import { beforeEach, describe, expect, it, vi } from "vitest";

const findManyMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const fetchZohoInvoiceEstimateSnapshotMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: {
    estimateCompanion: {
      findMany: findManyMock,
      update: updateMock,
    },
  },
}));

vi.mock("@/lib/zoho-invoice", () => ({
  fetchZohoInvoiceEstimateSnapshot: fetchZohoInvoiceEstimateSnapshotMock,
}));

import { runEstimateCompanionSync } from "@/lib/estimate-companion-sync";

describe("estimate companion sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates provider lifecycle state from Zoho snapshots", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "estimate_123",
        externalId: "zoho_estimate_123",
        externalNumber: "EST-000123",
        externalUrl: null,
        status: "created",
        metadataJson: null,
      },
    ]);
    fetchZohoInvoiceEstimateSnapshotMock.mockResolvedValueOnce({
      ok: true,
      status: "ok",
      provider: "zoho-invoice",
      estimateId: "zoho_estimate_123",
      estimateNumber: "EST-000123",
      referenceNumber: "ZK-VAL-20260329-ABC123-A1B2",
      estimateStatus: "sent",
      lastModifiedTime: "2026-03-29T12:00:00-0500",
      isViewedByClient: true,
      externalUrl: "https://invoice.zoho.com/estimate/123",
    });
    updateMock.mockResolvedValueOnce({ id: "estimate_123" });

    const result = await runEstimateCompanionSync();

    expect(result).toEqual({
      status: "ok",
      scanned: 1,
      updated: 1,
      unchanged: 0,
      failed: 0,
    });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "estimate_123" },
        data: expect.objectContaining({
          status: "viewed",
          externalUrl: "https://invoice.zoho.com/estimate/123",
        }),
      }),
    );
  });

  it("returns not_configured when Zoho sync cannot authenticate", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "estimate_123",
        externalId: "zoho_estimate_123",
        externalNumber: null,
        externalUrl: null,
        status: "created",
        metadataJson: null,
      },
    ]);
    fetchZohoInvoiceEstimateSnapshotMock.mockResolvedValueOnce({
      ok: false,
      status: "not_configured",
      provider: null,
      estimateId: "zoho_estimate_123",
      error: "ZOHO_INVOICE_NOT_CONFIGURED",
    });

    await expect(runEstimateCompanionSync()).resolves.toEqual({
      status: "not_configured",
      error: "ZOHO_INVOICE_NOT_CONFIGURED",
    });
    expect(updateMock).not.toHaveBeenCalled();
  });
});

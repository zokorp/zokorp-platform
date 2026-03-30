import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const upsertMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: {
    estimateCompanion: {
      upsert: upsertMock,
    },
  },
}));

import { recordEstimateCompanion } from "@/lib/estimate-companions";

describe("estimate companion persistence", () => {
  it("upserts by reference code", async () => {
    upsertMock.mockResolvedValueOnce({ id: "estimate_123" });

    const result = await recordEstimateCompanion({
      userId: "user_123",
      source: "zokorp-validator",
      sourceRecordKey: "ZK-VAL-20260329-ABC123-A1B2",
      sourceLabel: "FTR remediation estimate",
      provider: "zoho-invoice",
      status: "created",
      referenceCode: "ZK-VAL-20260329-ABC123-A1B2",
      customerEmail: "owner@acmecloud.com",
      amountUsd: 625,
    });

    expect(result).toEqual({ id: "estimate_123" });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { referenceCode: "ZK-VAL-20260329-ABC123-A1B2" },
      }),
    );
  });

  it("returns null on schema drift", async () => {
    upsertMock.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("missing table", {
        code: "P2021",
        clientVersion: "test",
      }),
    );

    await expect(
      recordEstimateCompanion({
        source: "architecture-review",
        sourceLabel: "Architecture Diagram Reviewer (AWS)",
        status: "failed",
        referenceCode: "ZK-ARCH-20260329-ABC123",
        customerEmail: "owner@acmecloud.com",
        amountUsd: 0,
      }),
    ).resolves.toBeNull();
  });
});

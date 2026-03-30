import { describe, expect, it } from "vitest";

import {
  estimateBandForRange,
  normalizeToolConsent,
  retentionPolicy,
  scoreBandForScore,
} from "@/lib/tool-consent";

describe("tool consent and retention policy", () => {
  it("defaults both consent flags to false", () => {
    expect(normalizeToolConsent({})).toEqual({
      saveForFollowUp: false,
      allowCrmFollowUp: false,
    });
  });

  it("keeps the configured archive retention window at 30 days", () => {
    expect(retentionPolicy.archiveRetentionDays).toBe(30);
    expect(retentionPolicy.fingerprintTtlMinutes).toBe(15);
  });

  it("derives stable score bands from numeric scores", () => {
    expect(scoreBandForScore(96)).toBe("90-100");
    expect(scoreBandForScore(78)).toBe("60-89");
    expect(scoreBandForScore(54)).toBe("0-59");
    expect(scoreBandForScore(31)).toBe("0-59");
    expect(scoreBandForScore(8)).toBe("0-59");
  });

  it("derives an estimate band from a low/high range", () => {
    expect(estimateBandForRange(200, 600)).toBe("under-500");
    expect(estimateBandForRange(1900, 2500)).toBe("1500-4999");
    expect(estimateBandForRange(12000, 18000)).toBe("10000-plus");
  });
});

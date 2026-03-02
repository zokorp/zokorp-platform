import { describe, expect, it } from "vitest";

import { getValidatorTargetOptions, resolveValidatorTargetContext } from "@/lib/validator-library";

describe("validator library", () => {
  it("loads profile-aware target options from generated library", () => {
    const all = getValidatorTargetOptions();
    const ftr = getValidatorTargetOptions("FTR");
    const sdpSrp = getValidatorTargetOptions("SDP_SRP");
    const competency = getValidatorTargetOptions("COMPETENCY");

    expect(all.length).toBeGreaterThan(100);
    expect(ftr.length).toBeGreaterThan(10);
    expect(sdpSrp.length).toBeGreaterThan(10);
    expect(competency.length).toBeGreaterThan(10);
  });

  it("resolves a default context when no explicit target id is provided", () => {
    const context = resolveValidatorTargetContext("FTR");

    expect(context).toBeDefined();
    expect(context?.track).toBe("ftr");
    expect(context?.label.length).toBeGreaterThan(0);
  });
});

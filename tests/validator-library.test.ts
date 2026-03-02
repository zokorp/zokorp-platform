import { describe, expect, it } from "vitest";

import { getValidatorTargetOptions, resolveValidatorTargetContext } from "@/lib/validator-library";

describe("validator library", () => {
  it("loads profile-aware target options from generated library", () => {
    const all = getValidatorTargetOptions();
    const ftr = getValidatorTargetOptions("FTR");
    const sdp = getValidatorTargetOptions("SDP");
    const srp = getValidatorTargetOptions("SRP");
    const competency = getValidatorTargetOptions("COMPETENCY");

    expect(all.length).toBeGreaterThan(100);
    expect(ftr.length).toBe(2);
    expect(sdp.length).toBeGreaterThan(10);
    expect(srp.length).toBeGreaterThan(10);
    expect(competency.length).toBeGreaterThan(10);
  });

  it("resolves a default context when no explicit target id is provided", () => {
    const context = resolveValidatorTargetContext("FTR");

    expect(context).toBeDefined();
    expect(context?.track).toBe("ftr");
    expect(context?.label.length).toBeGreaterThan(0);
  });
});

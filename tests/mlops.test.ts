import { describe, expect, it } from "vitest";

import { calculateP50, calculateP95, simpleDistributionDrift } from "@/lib/mlops";

describe("mlops math helpers", () => {
  it("computes p50 for odd and even samples", () => {
    expect(calculateP50([10, 1, 5])).toBe(5);
    expect(calculateP50([1, 3, 5, 7])).toBe(4);
  });

  it("computes p95 from sorted sample index", () => {
    expect(calculateP95([5, 10, 50, 100, 120])).toBe(120);
    expect(calculateP95([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(10);
  });

  it("computes simple normalized drift score", () => {
    const drift = simpleDistributionDrift({
      baseline: [100, 100, 100],
      current: [120, 120, 120],
    });

    expect(drift).toBe(0.2);
  });
});

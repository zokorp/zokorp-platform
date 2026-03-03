import { describe, expect, it } from "vitest";

import { generateRunnerApiKey, getRunnerKeyPrefix } from "@/lib/mlops-runner-keys";

describe("mlops runner keys", () => {
  it("generates prefixed key", () => {
    const key = generateRunnerApiKey();
    expect(key.startsWith("zkr_")).toBe(true);
    expect(key.length).toBeGreaterThan(20);
  });

  it("returns bounded prefix", () => {
    const key = "zkr_abcdefghijklmnopqrstuvwxyz";
    expect(getRunnerKeyPrefix(key)).toBe("zkr_abcdefghijkl");
  });
});

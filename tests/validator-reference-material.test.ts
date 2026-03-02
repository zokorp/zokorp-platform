import { describe, expect, it } from "vitest";

import { loadTargetReferenceMaterial } from "@/lib/validator-reference-material";

describe("validator reference material", () => {
  it("returns empty keyword set when no target is provided", async () => {
    const result = await loadTargetReferenceMaterial(undefined);

    expect(result.keywords.length).toBe(0);
    expect(result.notes.length).toBe(0);
  });
});

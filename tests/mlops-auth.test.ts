import { describe, expect, it } from "vitest";

import { hasOrgRole } from "@/lib/mlops-auth";

describe("mlops org role hierarchy", () => {
  it("grants equal or higher roles", () => {
    expect(hasOrgRole("OWNER", "ADMIN")).toBe(true);
    expect(hasOrgRole("ADMIN", "MEMBER")).toBe(true);
    expect(hasOrgRole("MEMBER", "VIEWER")).toBe(true);
  });

  it("denies lower roles", () => {
    expect(hasOrgRole("VIEWER", "MEMBER")).toBe(false);
    expect(hasOrgRole("MEMBER", "ADMIN")).toBe(false);
    expect(hasOrgRole("ADMIN", "OWNER")).toBe(false);
  });
});

/* @vitest-environment node */

import { describe, expect, it } from "vitest";

import { metadata as caseStudiesMetadata } from "@/app/case-studies/page";
import { CASE_STUDIES } from "@/lib/case-studies";

describe("CaseStudiesPage", () => {
  it("publishes a canonical /case-studies URL on the marketing host", () => {
    expect(caseStudiesMetadata.alternates?.canonical).toBe(
      "https://www.zokorp.com/case-studies",
    );
  });

  it("includes at least three published case studies", () => {
    expect(CASE_STUDIES.length).toBeGreaterThanOrEqual(3);
    for (const study of CASE_STUDIES) {
      expect(study.slug).toMatch(/^[a-z0-9-]+$/);
      expect(study.title.length).toBeGreaterThan(10);
      expect(study.outcome.length).toBeGreaterThan(10);
    }
  });
});

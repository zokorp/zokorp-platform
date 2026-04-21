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

  it("includes at least three published case studies with full STAR content", () => {
    expect(CASE_STUDIES.length).toBeGreaterThanOrEqual(3);
    for (const study of CASE_STUDIES) {
      expect(study.slug).toMatch(/^[a-z0-9-]+$/);
      expect(study.title.length).toBeGreaterThan(10);
      expect(study.summary.length).toBeGreaterThan(20);
      expect(study.outcomeHeadline.length).toBeGreaterThan(20);
      expect(study.result.primary.length).toBeGreaterThan(20);
      expect(study.situation.length).toBeGreaterThan(0);
      expect(study.task.length).toBeGreaterThan(0);
      expect(study.action.moves.length).toBeGreaterThan(0);
      expect(study.result.metrics.length).toBeGreaterThan(0);
      expect(study.portable.length).toBeGreaterThan(0);
      expect(study.technologies.length).toBeGreaterThan(0);
    }
  });
});

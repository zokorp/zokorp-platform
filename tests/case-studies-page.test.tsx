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

  it("publishes four case studies with full content, PDFs, tags, and role/duration", () => {
    expect(CASE_STUDIES.length).toBe(4);
    const expectedSlugs = new Set([
      "aws-partner-sa",
      "azure-nhl-llmops",
      "nordic-ai-ivr",
      "series-b-ai-cost-audit",
    ]);
    for (const study of CASE_STUDIES) {
      expect(expectedSlugs.has(study.slug)).toBe(true);
      expect(study.slug).toMatch(/^[a-z0-9-]+$/);
      expect(study.title.length).toBeGreaterThan(10);
      expect(study.role.length).toBeGreaterThan(3);
      expect(study.duration.length).toBeGreaterThan(3);
      expect(study.summary.length).toBeGreaterThan(20);
      expect(study.outcomeHeadline.length).toBeGreaterThan(20);
      expect(study.pdfPath).toBe(`/case-studies/${study.slug}.pdf`);
      expect(study.tags.length).toBeGreaterThan(0);
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

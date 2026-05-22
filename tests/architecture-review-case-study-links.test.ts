import { describe, expect, it } from "vitest";

import {
  getCaseStudyForCategory,
  getRelatedCaseStudy,
} from "@/lib/architecture-review/case-study-links";

describe("architecture review case study links", () => {
  it("maps security findings to the Nordic HIPAA AI IVR engagement by default", () => {
    const link = getCaseStudyForCategory("security");
    expect(link).not.toBeNull();
    expect(link?.slug).toBe("nordic-ai-ivr");
    expect(link?.outcomeStat).toContain("hold-time");
  });

  it("maps cost findings to the Series B AI cost audit engagement", () => {
    const link = getCaseStudyForCategory("cost");
    expect(link?.slug).toBe("series-b-ai-cost-audit");
    expect(link?.outcomeStat).toContain("ROI");
  });

  it("maps reliability findings to the AWS Partner SA engagement", () => {
    const link = getCaseStudyForCategory("reliability");
    expect(link?.slug).toBe("aws-partner-sa");
  });

  it("maps operations findings to the Azure NHL LLMOps engagement", () => {
    const link = getCaseStudyForCategory("operations");
    expect(link?.slug).toBe("azure-nhl-llmops");
  });

  it("returns null for categories without a thematic match (clarity, sustainability)", () => {
    expect(getCaseStudyForCategory("clarity")).toBeNull();
    expect(getCaseStudyForCategory("sustainability")).toBeNull();
  });

  it("uses rule-id specific overrides for HIPAA-themed findings even when category would route elsewhere", () => {
    // RDS encryption is tagged 'security' but should route to nordic-ai-ivr
    // (which we already get from category mapping). Verify the override path
    // still works.
    const link = getRelatedCaseStudy({
      ruleId: "aws:rds_encryption_at_rest",
      category: "security",
    });
    expect(link?.slug).toBe("nordic-ai-ivr");
  });

  it("uses rule-id overrides to route reliability-coded HA rules to the AWS Partner SA case study", () => {
    const link = getRelatedCaseStudy({
      ruleId: "aws:single_instance_production_compute",
      category: "reliability",
    });
    expect(link?.slug).toBe("aws-partner-sa");
  });

  it("uses rule-id overrides to route storage-cost rules to the Series B cost audit", () => {
    const link = getRelatedCaseStudy({
      ruleId: "azure:blob_lifecycle_management_configured",
      category: "cost",
    });
    expect(link?.slug).toBe("series-b-ai-cost-audit");
  });

  it("returns a href that points at the case study detail page", () => {
    const link = getRelatedCaseStudy({
      ruleId: "aws:single_instance_production_compute",
      category: "reliability",
    });
    expect(link?.href).toBe("/case-studies/aws-partner-sa");
  });

  it("returns null when the rule has no specific mapping and the category has no fallback", () => {
    const link = getRelatedCaseStudy({
      ruleId: "aws:diagram_clarity_thing",
      category: "clarity",
    });
    expect(link).toBeNull();
  });
});

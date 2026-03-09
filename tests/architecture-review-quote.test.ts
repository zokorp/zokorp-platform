import { describe, expect, it } from "vitest";

import {
  calculateAnalysisConfidence,
  calculateConsultationQuoteUSD,
  calculateFixCostUSD,
  calculateOverallScore,
  determineQuoteTier,
} from "@/lib/architecture-review/quote";

describe("architecture quote calculator", () => {
  it("maps category + points to deterministic fix cost", () => {
    expect(calculateFixCostUSD("performance", 6)).toBe(150);
    expect(calculateFixCostUSD("security", 12)).toBeGreaterThanOrEqual(150);
    expect(calculateFixCostUSD("security", 12)).toBeLessThanOrEqual(300);
    expect(calculateFixCostUSD("sustainability", 0)).toBe(0);
  });

  it("computes score and applies quote cap by score bucket", () => {
    const findings = [
      {
        ruleId: "SEC-1",
        category: "security" as const,
        pointsDeducted: 12,
        message: "Add IAM boundary.",
        fix: "Define least-privilege roles.",
        evidence: "IAM missing.",
        fixCostUSD: 290,
      },
      {
        ruleId: "REL-1",
        category: "reliability" as const,
        pointsDeducted: 10,
        message: "Add failover plan.",
        fix: "Document RTO/RPO and backup restore.",
        evidence: "No DR details.",
        fixCostUSD: 340,
      },
    ];

    const score = calculateOverallScore(findings);
    const quote = calculateConsultationQuoteUSD(findings, score);

    expect(score).toBe(78);
    expect(quote).toBeLessThanOrEqual(1500);
    expect(quote).toBe(249 + 290 + 340);
  });

  it("caps category deductions instead of summing unlimited penalties", () => {
    const score = calculateOverallScore([
      { category: "security", pointsDeducted: 18 },
      { category: "security", pointsDeducted: 17 },
      { category: "clarity", pointsDeducted: 12 },
    ]);

    expect(score).toBe(63);
  });

  it("keeps low-confidence reviews at the advisory baseline", () => {
    const findings = [
      {
        ruleId: "MSFT-COMPONENT-LABEL-COVERAGE",
        category: "clarity" as const,
        pointsDeducted: 6,
        message: "Explain each major component used in the diagram.",
        fix: "Reference key services and state each role.",
        evidence: "Token coverage low.",
        fixCostUSD: 40,
      },
      {
        ruleId: "CLAR-REL-LABELS-MISSING",
        category: "clarity" as const,
        pointsDeducted: 4,
        message: "Label relationships with protocol.",
        fix: "Add HTTPS/gRPC/event labels.",
        evidence: "Protocol labels missing.",
        fixCostUSD: 35,
      },
      {
        ruleId: "PILLAR-SECURITY",
        category: "security" as const,
        pointsDeducted: 12,
        message: "Document security controls.",
        fix: "Add IAM, encryption, and secrets handling.",
        evidence: "Missing security terms.",
        fixCostUSD: 260,
      },
    ];

    const score = calculateOverallScore(findings);
    const quote = calculateConsultationQuoteUSD(findings, score, {
      tokenCount: 22,
      ocrCharacterCount: 200,
      mode: "rules-only",
      workloadCriticality: "standard",
      desiredEngagement: "hands-on-remediation",
    });

    expect(quote).toBe(249);
  });

  it("returns review-call quote when review-call-only engagement is selected", () => {
    const findings = [
      {
        ruleId: "PILLAR-RELIABILITY",
        category: "reliability" as const,
        pointsDeducted: 10,
        message: "Specify failover and recovery targets.",
        fix: "Define backup restore and DR objectives.",
        evidence: "No DR terms.",
        fixCostUSD: 280,
      },
    ];

    const score = calculateOverallScore(findings);
    const quote = calculateConsultationQuoteUSD(findings, score, {
      tokenCount: 10,
      mode: "webllm",
      ocrCharacterCount: 1200,
      desiredEngagement: "review-call-only",
      workloadCriticality: "standard",
    });

    expect(quote).toBe(249);
  });

  it("derives confidence band and quote tier deterministically", () => {
    const findings = [
      {
        ruleId: "MSFT-COMPONENT-LABEL-COVERAGE",
        category: "clarity" as const,
        pointsDeducted: 6,
        message: "Explain each major component used in the diagram.",
        fix: "Reference key services and state each role.",
        evidence: "Token coverage low.",
        fixCostUSD: 40,
      },
      {
        ruleId: "PILLAR-SECURITY",
        category: "security" as const,
        pointsDeducted: 12,
        message: "Document security controls.",
        fix: "Add IAM, encryption, and secrets handling.",
        evidence: "Missing security terms.",
        fixCostUSD: 260,
      },
    ];

    const confidence = calculateAnalysisConfidence(findings, {
      tokenCount: 18,
      ocrCharacterCount: 150,
      mode: "rules-only",
      desiredEngagement: "hands-on-remediation",
      workloadCriticality: "standard",
    });

    const quoteTier = determineQuoteTier({
      overallScore: calculateOverallScore(findings),
      analysisConfidence: confidence,
      desiredEngagement: "hands-on-remediation",
    });

    expect(confidence).toBe("medium");
    expect(quoteTier).toBe("remediation-sprint");
  });

  it("forces regulated scopes into custom-after-call pricing", () => {
    const findings = [
      {
        ruleId: "SEC-BASELINE-MISSING",
        category: "security" as const,
        pointsDeducted: 8,
        message: "Map the architecture to the required control baseline.",
        fix: "Document the compliance controls and their placement in the request path.",
        evidence: "Regulated scope is present without explicit control mapping.",
        fixCostUSD: 205,
      },
    ];

    const score = calculateOverallScore(findings);
    const quote = calculateConsultationQuoteUSD(findings, score, {
      tokenCount: 24,
      ocrCharacterCount: 720,
      mode: "rules-only",
      workloadCriticality: "standard",
      desiredEngagement: "hands-on-remediation",
      regulatoryScope: "soc2",
    });
    const quoteTier = determineQuoteTier({
      overallScore: score,
      desiredEngagement: "hands-on-remediation",
      analysisConfidence: "high",
      regulatoryScope: "soc2",
    });

    expect(quote).toBe(249);
    expect(quoteTier).toBe("implementation-partner");
  });
});

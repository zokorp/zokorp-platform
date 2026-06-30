import { describe, expect, it } from "vitest";

import {
  buildReviewerSynthesis,
  buildReviewerSynthesisLines,
  buildSequencingNote,
  calculateAnalysisConfidence,
  calculateConsultationQuoteUSD,
  calculateFixCostUSD,
  calculateOverallScore,
  calculatePillarScores,
  determineQuoteTier,
  getFindingSeverityLabel,
  selectQuickWins,
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

  it("uses the full weighted deduction model for launch-v1 scoring", () => {
    const score = calculateOverallScore([
      { category: "security", pointsDeducted: 18 },
      { category: "security", pointsDeducted: 17 },
      { category: "clarity", pointsDeducted: 12 },
    ]);

    expect(score).toBe(53);
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
      mode: "rules-only",
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

    const confidence = calculateAnalysisConfidence(findings);

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

  it("breaks the score down by pillar so the customer sees where they are weakest", () => {
    const findings = [
      { ruleId: "aws:public_database_exposure", category: "security" as const, pointsDeducted: 15 },
      { ruleId: "aws:internet_facing_endpoint_without_tls", category: "security" as const, pointsDeducted: 8 },
      { ruleId: "aws:single_instance_production_compute", category: "reliability" as const, pointsDeducted: 6 },
      { ruleId: "aws:centralized_application_logging", category: "operations" as const, pointsDeducted: 4 },
    ];

    const pillars = calculatePillarScores(findings);
    const byCategory = Object.fromEntries(pillars.map((pillar) => [pillar.category, pillar]));

    expect(byCategory.security.score).toBe(100 - 23);
    expect(byCategory.security.tone).toBe("critical");
    expect(byCategory.security.findingsCount).toBe(2);
    expect(byCategory.security.pointsDeducted).toBe(23);

    expect(byCategory.reliability.score).toBe(94);
    expect(byCategory.reliability.tone).toBe("ok");

    expect(byCategory.operations.score).toBe(96);
    expect(byCategory.operations.findingsCount).toBe(1);

    expect(byCategory.performance.score).toBe(100);
    expect(byCategory.performance.findingsCount).toBe(0);
    expect(byCategory.performance.tone).toBe("ok");

    // Display order is stable and security-first.
    expect(pillars.map((pillar) => pillar.category)).toEqual([
      "security",
      "reliability",
      "operations",
      "performance",
      "cost",
      "clarity",
    ]);
  });

  it("maps points to severity labels customers actually scan for", () => {
    expect(getFindingSeverityLabel(12)).toBe("CRITICAL");
    expect(getFindingSeverityLabel(15)).toBe("CRITICAL");
    expect(getFindingSeverityLabel(8)).toBe("HIGH");
    expect(getFindingSeverityLabel(11)).toBe("HIGH");
    expect(getFindingSeverityLabel(4)).toBe("MEDIUM");
    expect(getFindingSeverityLabel(7)).toBe("MEDIUM");
    expect(getFindingSeverityLabel(2)).toBe("LOW");
    expect(getFindingSeverityLabel(0)).toBe("LOW");
  });

  it("picks quick wins by impact-per-hour and respects the 'do this week' cap", () => {
    const ruleHours: Record<string, { low: number; high: number }> = {
      "aws:fast-fix-big-impact": { low: 1, high: 2 },
      "aws:slow-fix-bigger-impact": { low: 6, high: 12 },
      "aws:tiny-fix-tiny-impact": { low: 0.5, high: 1 },
      "aws:medium-fix-medium-impact": { low: 2, high: 4 },
      "aws:zero-hour-fix": { low: 0, high: 0 },
    };

    const findings = [
      { ruleId: "aws:fast-fix-big-impact", category: "security" as const, pointsDeducted: 10, why: "Why A", howToFix: "Fix A" },
      { ruleId: "aws:slow-fix-bigger-impact", category: "security" as const, pointsDeducted: 18, why: "Why B", howToFix: "Fix B" },
      { ruleId: "aws:tiny-fix-tiny-impact", category: "operations" as const, pointsDeducted: 1, why: "Why C", howToFix: "Fix C" },
      { ruleId: "aws:medium-fix-medium-impact", category: "security" as const, pointsDeducted: 6, why: "Why D", howToFix: "Fix D" },
      { ruleId: "aws:zero-hour-fix", category: "clarity" as const, pointsDeducted: 4, why: "Why E", howToFix: "Fix E" },
    ];

    const wins = selectQuickWins(findings, {
      ruleHoursLookup: (ruleId) => ruleHours[ruleId] ?? null,
    });

    // 3 picks, all within the 8-hour ceiling.
    expect(wins).toHaveLength(3);
    expect(wins.map((win) => win.ruleId)).toEqual([
      "aws:fast-fix-big-impact",   // 10 pts / 2 hrs = 5.0
      "aws:medium-fix-medium-impact", // 6 pts / 4 hrs = 1.5
      "aws:tiny-fix-tiny-impact",   // 1 pt / 1 hr = 1.0
    ]);

    // Slow-fix-bigger-impact got dropped because high hours > 8 (sprint scope, not quick win).
    expect(wins.find((win) => win.ruleId === "aws:slow-fix-bigger-impact")).toBeUndefined();
    // Zero-hour fix got dropped because the rule has no hours to estimate.
    expect(wins.find((win) => win.ruleId === "aws:zero-hour-fix")).toBeUndefined();
  });

  it("returns no quick wins when every mandatory finding requires more than a day", () => {
    const findings = [
      { ruleId: "aws:multi-day-1", category: "security" as const, pointsDeducted: 12 },
      { ruleId: "aws:multi-day-2", category: "reliability" as const, pointsDeducted: 10 },
    ];

    const wins = selectQuickWins(findings, {
      ruleHoursLookup: () => ({ low: 12, high: 24 }),
    });

    expect(wins).toEqual([]);
  });

  it("writes a reviewer's note that names the top critical finding when there are 3+ criticals", () => {
    const findings = [
      { ruleId: "aws:public_database_exposure", category: "security" as const, pointsDeducted: 15, why: "A production database is publicly reachable" },
      { ruleId: "aws:no_backup_strategy_for_stateful_data", category: "reliability" as const, pointsDeducted: 14, why: "Stateful data has no backup story" },
      { ruleId: "aws:internet_facing_endpoint_without_tls", category: "security" as const, pointsDeducted: 12, why: "Public traffic is unencrypted" },
    ];
    const pillarScores = calculatePillarScores(findings);

    const note = buildReviewerSynthesis({
      findings,
      pillarScores,
      overallScore: 59,
      analysisConfidence: "high",
    });

    expect(note).toContain("Three or more critical risks");
    expect(note).toContain("A production database is publicly reachable");
  });

  it("collapses to consultation framing when analysis confidence is low", () => {
    const findings = [
      { ruleId: "aws:rule-a", category: "security" as const, pointsDeducted: 6 },
    ];
    const pillarScores = calculatePillarScores(findings);

    const note = buildReviewerSynthesis({
      findings,
      pillarScores,
      overallScore: 94,
      analysisConfidence: "low",
    });

    expect(note).toContain("can't draw a strong conclusion");
  });

  it("celebrates when the score is high and there are no mandatory deductions", () => {
    const note = buildReviewerSynthesis({
      findings: [],
      pillarScores: [],
      overallScore: 100,
      analysisConfidence: "high",
    });

    expect(note).toContain("No mandatory deductions");
  });

  it("emits a sequencing paragraph that names the top critical's pillar", () => {
    const findings = [
      { ruleId: "aws:public_database_exposure", category: "security" as const, pointsDeducted: 15, why: "Public DB" },
      { ruleId: "aws:no_backup_strategy_for_stateful_data", category: "reliability" as const, pointsDeducted: 14, why: "No backups" },
      { ruleId: "aws:internet_facing_endpoint_without_tls", category: "security" as const, pointsDeducted: 12, why: "No TLS" },
    ];
    const pillarScores = calculatePillarScores(findings);

    const lines = buildReviewerSynthesisLines({
      findings,
      pillarScores,
      overallScore: 59,
      analysisConfidence: "high",
    });

    expect(lines.sequencing).toContain("If this were my workload");
    expect(lines.sequencing).toContain("security");
    expect(lines.sequencing).toContain("Remediation Sprint");
  });

  it("emits a deferral sequencing paragraph when score is polish-tier", () => {
    const findings = [
      { ruleId: "aws:waf_on_public_endpoints", category: "security" as const, pointsDeducted: 1 },
    ];
    const pillarScores = calculatePillarScores(findings);

    const note = buildSequencingNote({
      findings,
      pillarScores,
      overallScore: 95,
      analysisConfidence: "high",
    });

    expect(note).toContain("If this were my workload");
    expect(note).toMatch(/defer|polish|next planned release/);
  });

  it("emits a book-the-call sequencing paragraph when confidence is low", () => {
    const findings = [
      { ruleId: "aws:rule-a", category: "security" as const, pointsDeducted: 6 },
    ];
    const pillarScores = calculatePillarScores(findings);

    const note = buildSequencingNote({
      findings,
      pillarScores,
      overallScore: 88,
      analysisConfidence: "low",
    });

    expect(note).toContain("If this were my workload");
    expect(note).toMatch(/book the review call|too thin/i);
  });

  it("identifies cumulative pressure when there are no criticals but enough findings", () => {
    const findings = [
      { ruleId: "aws:rule-a", category: "security" as const, pointsDeducted: 5, why: "x" },
      { ruleId: "aws:rule-b", category: "reliability" as const, pointsDeducted: 4, why: "y" },
      { ruleId: "aws:rule-c", category: "operations" as const, pointsDeducted: 3, why: "z" },
      { ruleId: "aws:rule-d", category: "operations" as const, pointsDeducted: 3, why: "w" },
    ];
    const pillarScores = calculatePillarScores(findings);

    const note = buildReviewerSynthesis({
      findings,
      pillarScores,
      overallScore: 85,
      analysisConfidence: "high",
    });

    expect(note).toContain("cumulative");
    expect(note).toMatch(/security|reliability|operations/);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildLandingZoneReadinessReport, buildCategoryScores, maturityBandFromScore, sortLandingZoneFindings } from "@/lib/landing-zone-readiness/engine";
import { isAllowedLandingZoneBusinessEmail } from "@/lib/landing-zone-readiness/input";
import { landingZoneReadinessAnswersSchema, type LandingZoneReadinessAnswers } from "@/lib/landing-zone-readiness/types";

function makeAnswers(overrides: Partial<LandingZoneReadinessAnswers> = {}): LandingZoneReadinessAnswers {
  return landingZoneReadinessAnswersSchema.parse({
    email: "owner@acmecloud.com",
    fullName: "Jordan Rivera",
    companyName: "Acme Cloud",
    roleTitle: "CTO",
    website: "acmecloud.com",
    primaryCloud: "aws",
    secondaryCloud: undefined,
    numberOfEnvironments: "3",
    numberOfRegions: "2_3",
    employeeCount: "26_100",
    engineeringTeamSize: "6_20",
    handlesSensitiveData: false,
    hasSso: "yes",
    enforcesMfa: "yes",
    centralizedIdentity: "yes",
    breakGlassProcess: "yes",
    documentedRbac: "yes",
    serviceAccountHygiene: "yes",
    usesOrgHierarchy: "yes",
    separateCloudAccounts: "yes",
    sharedServicesModel: "yes",
    guardrailsPolicy: "yes",
    standardNetworkArchitecture: "yes",
    productionIsolation: "yes",
    ingressEgressControls: "yes",
    privateConnectivity: "yes",
    documentedDnsStrategy: "yes",
    networkCleanup: "yes",
    secretsManagement: "yes",
    keyManagement: "yes",
    baselineSecurityLogging: "yes",
    vulnerabilityScanning: "yes",
    privilegeReviews: "yes",
    patchingOwnership: "yes",
    centralizedLogs: "yes",
    metricsDashboards: "yes",
    alertingCoverage: "yes",
    backupCoverage: "yes",
    restoreTesting: "yes",
    definedRecoveryTargets: "yes",
    crossRegionResilience: "yes",
    drDocumentation: "yes",
    infrastructureAsCode: "yes",
    changesViaCiCd: "yes",
    manualProductionChanges: "blocked",
    codeReviewRequired: "yes",
    driftDetection: "yes",
    taggingStandard: "yes",
    budgetAlerts: "yes",
    resourceOwnership: "yes",
    lifecycleCleanup: "yes",
    nonProdShutdown: "yes",
    clearEnvironmentSeparation: "yes",
    runbooks: "yes",
    onCallOwnership: "yes",
    incidentResponseProcess: "yes",
    biggestChallenge: "",
    ...overrides,
  });
}

describe("landing zone readiness engine", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks common personal email domains", () => {
    expect(isAllowedLandingZoneBusinessEmail("architect@zokorp.com")).toBe(true);
    expect(isAllowedLandingZoneBusinessEmail("someone@gmail.com")).toBe(false);
    expect(isAllowedLandingZoneBusinessEmail("someone@outlook.com")).toBe(false);
  });

  it("produces deterministic scoring and quote output", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-06T18:00:00.000Z"));

    const answers = makeAnswers({
      secondaryCloud: "azure",
      handlesSensitiveData: true,
      enforcesMfa: "no",
      separateCloudAccounts: "no",
      productionIsolation: "no",
      secretsManagement: "no",
      centralizedLogs: "no",
      restoreTesting: "no",
      infrastructureAsCode: "no",
    });

    const first = buildLandingZoneReadinessReport(answers);
    const second = buildLandingZoneReadinessReport(answers);

    expect(first).toEqual(second);
    expect(first.overallScore).toBe(77);
    expect(first.quote.quoteTier).toBe("Landing Zone Hardening");
    expect(first.quote.quoteLow).toBe(13250);
    expect(first.quote.quoteHigh).toBe(30000);
    expect(first.quote.confidence).toBe("low");
  });

  it("computes category scores from weighted deductions", () => {
    const answers = makeAnswers({
      hasSso: "partial",
      enforcesMfa: "no",
      serviceAccountHygiene: "no",
    });

    const report = buildLandingZoneReadinessReport(answers);

    expect(report.categoryScores.identity_access).toBe(47);
    expect(report.overallScore).toBe(92);
  });

  it("maps maturity bands to the expected score ranges", () => {
    expect(maturityBandFromScore(95)).toBe("Strong Foundation");
    expect(maturityBandFromScore(80)).toBe("Usable but Gapped");
    expect(maturityBandFromScore(60)).toBe("At Risk");
    expect(maturityBandFromScore(30)).toBe("Fragile Foundation");
  });

  it("orders top findings by impact, then severity, then category", () => {
    const ordered = sortLandingZoneFindings([
      {
        ruleId: "DR-BACKUPS",
        category: "backup_dr",
        pointsDeducted: 2,
        severity: "medium",
        finding: "Backup coverage is incomplete.",
        fix: "Back up critical systems.",
      },
      {
        ruleId: "IAM-MFA",
        category: "identity_access",
        pointsDeducted: 4,
        severity: "high",
        finding: "MFA is not enforced everywhere it should be.",
        fix: "Require MFA for admins.",
      },
      {
        ruleId: "SEC-SECRETS",
        category: "security_baseline",
        pointsDeducted: 3,
        severity: "high",
        finding: "Secrets management is weak.",
        fix: "Use managed secret storage.",
      },
    ]);

    expect(ordered.map((finding) => finding.ruleId)).toEqual(["IAM-MFA", "SEC-SECRETS", "DR-BACKUPS"]);
  });

  it("creates full category score maps even when only one category has deductions", () => {
    const scores = buildCategoryScores({
      identity_access: 4,
      org_structure: 0,
      network_foundation: 0,
      security_baseline: 0,
      logging_monitoring: 0,
      backup_dr: 0,
      iac_delivery: 0,
      cost_governance: 0,
      environment_separation: 0,
      operations_readiness: 0,
    });

    expect(scores.identity_access).toBe(73);
    expect(scores.network_foundation).toBe(100);
    expect(scores.operations_readiness).toBe(100);
  });
});

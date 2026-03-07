import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  submissionCreate: vi.fn(),
  submissionUpdate: vi.fn(),
  auditCreate: vi.fn(),
  sendToolResultEmail: vi.fn(),
  upsertZohoLead: vi.fn(),
  consumeRateLimit: vi.fn(),
  getRequestFingerprint: vi.fn(),
  isSchemaDriftError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mocks.userFindUnique,
    },
    landingZoneReadinessSubmission: {
      create: mocks.submissionCreate,
      update: mocks.submissionUpdate,
    },
    auditLog: {
      create: mocks.auditCreate,
    },
  },
}));

vi.mock("@/lib/architecture-review/sender", () => ({
  sendToolResultEmail: mocks.sendToolResultEmail,
}));

vi.mock("@/lib/zoho-crm", () => ({
  upsertZohoLead: mocks.upsertZohoLead,
}));

vi.mock("@/lib/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  getRequestFingerprint: mocks.getRequestFingerprint,
}));

vi.mock("@/lib/db-errors", () => ({
  isSchemaDriftError: mocks.isSchemaDriftError,
}));

import { POST } from "@/app/api/submit-landing-zone-readiness/route";
import { landingZoneReadinessAnswersSchema, type LandingZoneReadinessAnswers } from "@/lib/landing-zone-readiness/types";

function makeAnswers(overrides: Partial<LandingZoneReadinessAnswers> = {}) {
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

function makeRequest(body: string, contentType = "application/json") {
  return new Request("https://app.zokorp.com/api/submit-landing-zone-readiness", {
    method: "POST",
    headers: {
      "content-type": contentType,
      "x-forwarded-for": "203.0.113.10",
      "user-agent": "vitest",
    },
    body,
  });
}

describe("submit landing zone readiness route", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.userFindUnique.mockResolvedValue(null);
    mocks.submissionCreate.mockResolvedValue({ id: "lzrc_123" });
    mocks.submissionUpdate.mockResolvedValue({ id: "lzrc_123" });
    mocks.auditCreate.mockResolvedValue({ id: "audit_123" });
    mocks.sendToolResultEmail.mockResolvedValue({ ok: true, provider: "smtp" });
    mocks.upsertZohoLead.mockResolvedValue({
      status: "not_configured",
      error: "ZOHO_CRM_ACCESS_TOKEN_MISSING",
    });
    mocks.consumeRateLimit.mockImplementation(() => ({
      allowed: true,
      remaining: 7,
      retryAfterSeconds: 3600,
    }));
    mocks.getRequestFingerprint.mockReturnValue("203.0.113.10");
    mocks.isSchemaDriftError.mockReturnValue(false);
  });

  it("rejects non-json submissions before any persistence work", async () => {
    const response = await POST(
      makeRequest("email=owner@acmecloud.com", "application/x-www-form-urlencoded"),
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      error: "Submissions must be sent as JSON.",
    });
    expect(mocks.submissionCreate).not.toHaveBeenCalled();
    expect(mocks.sendToolResultEmail).not.toHaveBeenCalled();
  });

  it("rejects personal email domains on the server", async () => {
    const response = await POST(
      makeRequest(JSON.stringify(makeAnswers({ email: "someone@gmail.com" }))),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Personal email domains are not allowed. Use your business email.",
    });
    expect(mocks.submissionCreate).not.toHaveBeenCalled();
  });

  it("throttles repeated submissions for the same email", async () => {
    mocks.consumeRateLimit
      .mockReturnValueOnce({
        allowed: true,
        remaining: 7,
        retryAfterSeconds: 3600,
      })
      .mockReturnValueOnce({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 3600,
      });

    const response = await POST(makeRequest(JSON.stringify(makeAnswers())));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "Too many submissions were sent for this email. Please wait and try again.",
    });
    expect(mocks.submissionCreate).not.toHaveBeenCalled();
  });

  it("persists a successful submission and records synced statuses", async () => {
    mocks.upsertZohoLead.mockResolvedValue({
      status: "success",
      recordId: "zoho_123",
      error: null,
    });

    const response = await POST(makeRequest(JSON.stringify(makeAnswers())));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("sent");
    expect(body.maturityBand).toBe("Strong Foundation");
    expect(mocks.submissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "owner@acmecloud.com",
          source: "landing-zone-readiness-checker",
        }),
      }),
    );
    expect(mocks.upsertZohoLead).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "owner@acmecloud.com",
        description: expect.stringContaining("EstimatedDays:"),
      }),
    );
    expect(mocks.submissionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          crmSyncStatus: "synced",
          zohoRecordId: "zoho_123",
          emailDeliveryStatus: "sent",
        }),
      }),
    );
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
  });

  it("returns fallback when email delivery fails after storing the lead", async () => {
    mocks.sendToolResultEmail.mockResolvedValue({
      ok: false,
      provider: "smtp",
      error: "SMTP_NOT_CONFIGURED",
    });

    const response = await POST(makeRequest(JSON.stringify(makeAnswers({ enforcesMfa: "no" }))));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "fallback",
      reason: "Automated email delivery was unavailable. Please retry shortly.",
    });
    expect(mocks.submissionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailDeliveryStatus: "failed",
          crmSyncStatus: "not_configured",
        }),
      }),
    );
  });
});

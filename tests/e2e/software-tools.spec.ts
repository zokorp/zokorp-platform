import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import {
  adminStorageStatePath,
  appBaseUrl,
  hasAdminStorageState,
  hasUserStorageState,
  localAuthBootstrapEnabled,
  userStorageStatePath,
} from "./auth";
import {
  attachPageDiagnostics,
  buildUrl,
  expectNoUnexpectedPageFailures,
  marketingBaseUrl,
} from "./helpers";

const reviewerFixturePath = path.join(process.cwd(), "tests/e2e/fixtures/architecture-reviewer-privacy.svg");
const reviewerPdfFixturePath = path.join(process.cwd(), "tests/e2e/fixtures/architecture-reviewer-privacy.pdf");
const reviewerScannedPdfFixturePath = path.join(
  process.cwd(),
  "tests/e2e/fixtures/architecture-reviewer-privacy-scanned.pdf",
);
const validatorFixturePath = path.join(process.cwd(), "tests/e2e/fixtures/validator-minimal.pdf");
const hasUserAuth = hasUserStorageState();
const hasAdminAuth = hasAdminStorageState();

function privacyModeToggle(page: Page) {
  return page.locator("form").locator('input[type="checkbox"]').first();
}

async function submitValidatorRequest(page: Page, fixtureBytes: number[]) {
  const response = await page.request.post(buildUrl(appBaseUrl, "/api/tools/zokorp-validator"), {
    failOnStatusCode: false,
    headers: {
      origin: new URL(appBaseUrl).origin,
      referer: buildUrl(appBaseUrl, "/software/zokorp-validator"),
    },
    multipart: {
      validationProfile: "FTR",
      file: {
        name: "validator-minimal.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(fixtureBytes),
      },
    },
  });

  const bodyText = await response.text();

  return {
    status: response.status(),
    body: bodyText ? JSON.parse(bodyText) : null,
  };
}

test.describe("software tool funnels", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Tool funnel coverage runs on desktop only.");
  });

  test("/software loads and shows tool cards", async ({ page }) => {
    const diagnostics = attachPageDiagnostics(page);

    await page.goto(buildUrl(marketingBaseUrl, "/software"), { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Software that supports the consulting model/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Architecture Diagram Reviewer" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "ZoKorpValidator" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "ZoKorp Forecasting Beta" }).first()).toBeVisible();

    expectNoUnexpectedPageFailures(diagnostics, "software hub");
  });

  test("architecture reviewer requires verified login and can open the sample report", async ({ page }) => {
    const diagnostics = attachPageDiagnostics(page);

    await page.goto(buildUrl(appBaseUrl, "/software/architecture-diagram-reviewer"), {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Verified business-email account required/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sign in to continue/i }).first()).toBeVisible();

    await page.getByRole("link", { name: /View sample report/i }).click();
    await expect(page).toHaveURL(/\/software\/architecture-diagram-reviewer\/sample-report$/);
    await expect(page.getByRole("heading", { name: /Architecture Diagram Reviewer Sample Report/i })).toBeVisible();

    expectNoUnexpectedPageFailures(diagnostics, "reviewer signed-out gate and sample report");
  });
});

test.describe("authenticated architecture reviewer", () => {
  test.use({ storageState: hasUserAuth ? userStorageStatePath : undefined });

  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Tool funnel coverage runs on desktop only.");
    test.skip(!hasUserAuth, "Authenticated reviewer coverage requires prepared storage state.");
  });

  test("privacy mode renders a local report and sends only minimal telemetry", async ({ page }) => {
    const diagnostics = attachPageDiagnostics(page);
    let telemetryBody: Record<string, unknown> | null = null;
    let standardSubmitCalled = false;

    await page.route("**/api/architecture-review/privacy-telemetry", async (route) => {
      telemetryBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          toolRunId: "toolrun_privacy_001",
          dedupedLeadFingerprint: false,
          requestId: "req_privacy_001",
        }),
      });
    });
    await page.route("**/api/submit-architecture-review", async (route) => {
      standardSubmitCalled = true;
      await route.abort();
    });

    await page.goto(buildUrl(appBaseUrl, "/software/architecture-diagram-reviewer"), {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("alert").filter({ hasText: "Verified account active" }).first()).toBeVisible();
    await privacyModeToggle(page).check();
    await page.locator('input[name="diagram"]').setInputFiles(reviewerFixturePath);
    await page.getByLabel(/Architecture Description/i).fill(
      "Users enter through CloudFront and API Gateway, Lambda writes DynamoDB, CloudWatch alerts on failures, and KMS protects sensitive data.",
    );
    await page.getByRole("button", { name: /Run Local Review/i }).click();

    await expect(page.getByText(/Report ready in browser/i)).toBeVisible();
    await expect(page.getByText(/Local privacy-mode report/i)).toBeVisible();
    await expect(page.getByText(/AWS score \d+\/100/i)).toBeVisible();

    expect(standardSubmitCalled).toBe(false);
    expect(telemetryBody).not.toBeNull();
    expect(Object.keys(telemetryBody ?? {}).sort()).toEqual([
      "emailDeliveryRequested",
      "scoreBand",
      "submissionFingerprintHash",
      "toolSlug",
    ]);
    expect(telemetryBody).toMatchObject({
      toolSlug: "architecture-diagram-reviewer",
      emailDeliveryRequested: false,
    });

    expectNoUnexpectedPageFailures(diagnostics, "reviewer privacy mode");
  });

  test("standard mode shows progress and finishes with mocked server status", async ({ page }) => {
    const diagnostics = attachPageDiagnostics(page);
    let statusPollCount = 0;

    await page.route("**/api/submit-architecture-review", async (route) => {
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          status: "queued",
          jobId: "job_e2e_001",
          phase: "upload-validate",
          progressPct: 5,
          etaSeconds: 2,
          deliveryMode: null,
        }),
      });
    });
    await page.route("**/api/architecture-review-status?*", async (route) => {
      statusPollCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          statusPollCount === 1
            ? {
                jobId: "job_e2e_001",
                status: "queued",
                phase: "rules",
                progressPct: 72,
                etaSeconds: 1,
                deliveryMode: null,
              }
            : {
                jobId: "job_e2e_001",
                status: "sent",
                phase: "completed",
                progressPct: 100,
                etaSeconds: 0,
                deliveryMode: "sent",
              },
        ),
      });
    });

    await page.goto(buildUrl(appBaseUrl, "/software/architecture-diagram-reviewer"), {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    await page.locator('input[name="diagram"]').setInputFiles(reviewerFixturePath);
    await page.getByLabel(/Architecture Description/i).fill(
      "Users enter through CloudFront and API Gateway, app services process requests, and DynamoDB stores system state.",
    );
    await page.getByRole("button", { name: /^Run Review$/i }).click();

    await expect(page.getByText(/Review in progress/i)).toBeVisible();
    await expect(page.getByText(/Processing: Validating submission/i)).toBeVisible();
    await expect(page.getByText(/Review complete/i)).toBeVisible();
    expect(statusPollCount).toBeGreaterThanOrEqual(2);

    expectNoUnexpectedPageFailures(diagnostics, "reviewer standard mode");
  });

  test("privacy mode renders a local report for text-based PDF uploads", async ({ page }) => {
    let telemetryBody: Record<string, unknown> | null = null;
    let standardSubmitCallCount = 0;

    await page.route("**/api/architecture-review/privacy-telemetry", async (route) => {
      telemetryBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          toolRunId: "toolrun_privacy_pdf_001",
          dedupedLeadFingerprint: false,
          requestId: "req_privacy_pdf_001",
        }),
      });
    });
    await page.route("**/api/submit-architecture-review", async (route) => {
      standardSubmitCallCount += 1;
      await route.abort();
    });

    await page.goto(buildUrl(appBaseUrl, "/software/architecture-diagram-reviewer"), {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    await privacyModeToggle(page).check();
    await page.locator('input[name="diagram"]').setInputFiles(reviewerPdfFixturePath);
    await page.getByLabel(/Architecture Description/i).fill(
      "Users enter through CloudFront, API Gateway forwards traffic, Lambda writes DynamoDB, and CloudWatch alarms on failures.",
    );
    await page.getByRole("button", { name: /Run Local Review/i }).click();

    await expect(page.getByText(/Report ready in browser/i)).toBeVisible();
    await expect(page.getByText(/Local privacy-mode report/i)).toBeVisible();
    await expect(page.getByText(/AWS score \d+\/100/i)).toBeVisible();

    expect(standardSubmitCallCount).toBe(0);
    expect(telemetryBody).toMatchObject({
      toolSlug: "architecture-diagram-reviewer",
      emailDeliveryRequested: false,
    });
  });

  test("privacy mode renders a local report for scanned PDF uploads", async ({ page }) => {
    let telemetryBody: Record<string, unknown> | null = null;
    let standardSubmitCallCount = 0;

    await page.route("**/api/architecture-review/privacy-telemetry", async (route) => {
      telemetryBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          toolRunId: "toolrun_privacy_pdf_scan_001",
          dedupedLeadFingerprint: false,
          requestId: "req_privacy_pdf_scan_001",
        }),
      });
    });
    await page.route("**/api/submit-architecture-review", async (route) => {
      standardSubmitCallCount += 1;
      await route.abort();
    });

    await page.goto(buildUrl(appBaseUrl, "/software/architecture-diagram-reviewer"), {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    await privacyModeToggle(page).check();
    await page.locator('input[name="diagram"]').setInputFiles(reviewerScannedPdfFixturePath);
    await page.getByLabel(/Architecture Description/i).fill(
      "CloudFront sends traffic to API Gateway, Lambda writes DynamoDB, and CloudWatch alarms when failures occur.",
    );
    await page.getByRole("button", { name: /Run Local Review/i }).click();

    await expect(page.getByText(/Report ready in browser/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Local privacy-mode report/i)).toBeVisible();
    await expect(page.getByText(/AWS score \d+\/100/i)).toBeVisible();

    expect(standardSubmitCallCount).toBe(0);
    expect(telemetryBody).toMatchObject({
      toolSlug: "architecture-diagram-reviewer",
      emailDeliveryRequested: false,
    });
  });
});

test.describe("validator access and entitlement checks", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Tool funnel coverage runs on desktop only.");
  });

  test("validator requires login when signed out", async ({ page }) => {
    const diagnostics = attachPageDiagnostics(page);

    await page.goto(buildUrl(appBaseUrl, "/software/zokorp-validator"), {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Run ZoKorpValidator/i })).toBeVisible();
    await expect(page.getByText(/Sign in first, then purchase the correct validation credit/i)).toBeVisible();

    expectNoUnexpectedPageFailures(diagnostics, "validator signed-out gate");
  });

});

test.describe("validator authenticated entitlement checks", () => {
  test.use({ storageState: hasUserAuth ? userStorageStatePath : undefined });

  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Tool funnel coverage runs on desktop only.");
    test.skip(!hasUserAuth || !localAuthBootstrapEnabled, "Real 402 validator coverage requires local authenticated storage state.");
  });

  test("validator API returns 402 for a signed-in user without credits", async ({ page }) => {
    const fixtureBytes = Array.from(readFileSync(validatorFixturePath));

    await page.goto(buildUrl(appBaseUrl, "/software/zokorp-validator"), {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");

    const response = await submitValidatorRequest(page, fixtureBytes);

    expect(response.status).toBe(402);
    expect(response.body).toMatchObject({
      error: "Purchase required before running this tool.",
    });
  });
});

test.describe("validator admin bypass", () => {
  test.use({ storageState: hasAdminAuth ? adminStorageStatePath : undefined });

  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Tool funnel coverage runs on desktop only.");
    test.skip(!hasAdminAuth || !localAuthBootstrapEnabled, "Admin bypass coverage requires local authenticated admin storage state.");
  });

  test("validator succeeds for the local admin-bypass environment", async ({ page }) => {
    const diagnostics = attachPageDiagnostics(page);
    const fixtureBytes = Array.from(readFileSync(validatorFixturePath));

    await page.goto(buildUrl(appBaseUrl, "/software/zokorp-validator"), {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Run ZoKorpValidator/i })).toBeVisible();

    const response = await submitValidatorRequest(page, fixtureBytes);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      adminBypass: true,
      report: {
        profile: "FTR",
      },
    });

    expectNoUnexpectedPageFailures(diagnostics, "validator admin bypass");
  });
});

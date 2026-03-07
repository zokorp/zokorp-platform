CREATE TABLE "CloudCostLeakFinderSubmission" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "roleTitle" TEXT NOT NULL,
  "website" TEXT,
  "primaryCloud" TEXT NOT NULL,
  "secondaryCloud" TEXT,
  "narrativeInput" TEXT NOT NULL,
  "billingSummaryInput" TEXT,
  "extractedSignalsJson" JSONB NOT NULL,
  "adaptiveAnswersJson" JSONB NOT NULL,
  "wasteRiskScore" INTEGER NOT NULL,
  "finopsMaturityScore" INTEGER NOT NULL,
  "savingsConfidenceScore" INTEGER NOT NULL,
  "implementationComplexityScore" INTEGER NOT NULL,
  "roiPlausibilityScore" INTEGER NOT NULL,
  "confidenceScore" INTEGER NOT NULL,
  "likelyWasteCategoriesJson" JSONB NOT NULL,
  "savingsEstimateJson" JSONB NOT NULL,
  "findingsJson" JSONB NOT NULL,
  "actionsJson" JSONB NOT NULL,
  "quoteJson" JSONB NOT NULL,
  "crmSyncStatus" TEXT,
  "emailDeliveryStatus" TEXT,
  "zohoRecordId" TEXT,
  "zohoSyncError" TEXT,
  "source" TEXT NOT NULL DEFAULT 'cloud-cost-leak-finder',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CloudCostLeakFinderSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CloudCostLeakFinderSubmission_createdAt_idx" ON "CloudCostLeakFinderSubmission"("createdAt");
CREATE INDEX "CloudCostLeakFinderSubmission_email_idx" ON "CloudCostLeakFinderSubmission"("email");
CREATE INDEX "CloudCostLeakFinderSubmission_crmSyncStatus_idx" ON "CloudCostLeakFinderSubmission"("crmSyncStatus");

ALTER TABLE "CloudCostLeakFinderSubmission"
ADD CONSTRAINT "CloudCostLeakFinderSubmission_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

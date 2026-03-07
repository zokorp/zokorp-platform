CREATE TABLE "LandingZoneReadinessSubmission" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "roleTitle" TEXT NOT NULL,
  "website" TEXT,
  "primaryCloud" TEXT NOT NULL,
  "secondaryCloud" TEXT,
  "answersJson" JSONB NOT NULL,
  "scoreOverall" INTEGER NOT NULL,
  "scoreByCategoryJson" JSONB NOT NULL,
  "maturityBand" TEXT NOT NULL,
  "findingsJson" JSONB NOT NULL,
  "quoteJson" JSONB NOT NULL,
  "freeTextChallenge" TEXT,
  "crmSyncStatus" TEXT,
  "emailDeliveryStatus" TEXT,
  "zohoRecordId" TEXT,
  "zohoSyncError" TEXT,
  "source" TEXT NOT NULL DEFAULT 'landing-zone-readiness-checker',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "LandingZoneReadinessSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LandingZoneReadinessSubmission_createdAt_idx" ON "LandingZoneReadinessSubmission"("createdAt");
CREATE INDEX "LandingZoneReadinessSubmission_email_idx" ON "LandingZoneReadinessSubmission"("email");
CREATE INDEX "LandingZoneReadinessSubmission_crmSyncStatus_idx" ON "LandingZoneReadinessSubmission"("crmSyncStatus");

ALTER TABLE "LandingZoneReadinessSubmission"
ADD CONSTRAINT "LandingZoneReadinessSubmission_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

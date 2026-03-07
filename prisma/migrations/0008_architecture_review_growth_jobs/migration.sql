-- Lead enrichment for architecture reviewer growth + CRM pipeline
ALTER TABLE "LeadLog"
ADD COLUMN "analysisConfidence" TEXT,
ADD COLUMN "quoteTier" TEXT,
ADD COLUMN "emailDeliveryMode" TEXT,
ADD COLUMN "leadStage" TEXT NOT NULL DEFAULT 'New Review',
ADD COLUMN "leadScore" INTEGER,
ADD COLUMN "ctaClicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastCtaClickedAt" TIMESTAMP(3),
ADD COLUMN "utmSource" TEXT,
ADD COLUMN "utmMedium" TEXT,
ADD COLUMN "utmCampaign" TEXT,
ADD COLUMN "landingPage" TEXT,
ADD COLUMN "referrer" TEXT,
ADD COLUMN "deviceClass" TEXT,
ADD COLUMN "clientTimingJson" JSONB,
ADD COLUMN "emailSentAt" TIMESTAMP(3),
ADD COLUMN "followUpStatusJson" JSONB,
ADD COLUMN "zohoSyncNeedsUpdate" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "LeadLog_leadStage_idx" ON "LeadLog"("leadStage");
CREATE INDEX "LeadLog_zohoSyncNeedsUpdate_idx" ON "LeadLog"("zohoSyncNeedsUpdate");
CREATE INDEX "LeadLog_emailSentAt_idx" ON "LeadLog"("emailSentAt");

-- Async architecture review job orchestration
CREATE TABLE "ArchitectureReviewJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "userEmail" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "currentPhase" TEXT,
  "progressPct" INTEGER NOT NULL DEFAULT 0,
  "etaSeconds" INTEGER,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "diagramFileName" TEXT NOT NULL,
  "diagramMimeType" TEXT NOT NULL,
  "diagramBytes" BYTEA NOT NULL,
  "metadataJson" JSONB NOT NULL,
  "submissionContextJson" JSONB,
  "clientTimingJson" JSONB,
  "phaseTimingsJson" JSONB,
  "reportJson" JSONB,
  "overallScore" INTEGER,
  "analysisConfidence" TEXT,
  "quoteTier" TEXT,
  "deliveryMode" TEXT,
  "fallbackReason" TEXT,
  "fallbackMailtoUrl" TEXT,
  "fallbackEmlToken" TEXT,
  "leadLogId" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3),
  "nextRetryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ArchitectureReviewJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ArchitectureReviewJob_status_idx" ON "ArchitectureReviewJob"("status");
CREATE INDEX "ArchitectureReviewJob_createdAt_idx" ON "ArchitectureReviewJob"("createdAt");
CREATE INDEX "ArchitectureReviewJob_userEmail_idx" ON "ArchitectureReviewJob"("userEmail");
CREATE INDEX "ArchitectureReviewJob_userId_idx" ON "ArchitectureReviewJob"("userId");
CREATE INDEX "ArchitectureReviewJob_leadLogId_idx" ON "ArchitectureReviewJob"("leadLogId");

ALTER TABLE "ArchitectureReviewJob"
ADD CONSTRAINT "ArchitectureReviewJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ArchitectureReviewJob"
ADD CONSTRAINT "ArchitectureReviewJob_leadLogId_fkey" FOREIGN KEY ("leadLogId") REFERENCES "LeadLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Email outbox for retries + fallback persistence
CREATE TABLE "ArchitectureReviewEmailOutbox" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "leadLogId" TEXT,
  "toEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "textBody" TEXT NOT NULL,
  "htmlBody" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "provider" TEXT,
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ArchitectureReviewEmailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ArchitectureReviewEmailOutbox_jobId_idx" ON "ArchitectureReviewEmailOutbox"("jobId");
CREATE INDEX "ArchitectureReviewEmailOutbox_leadLogId_idx" ON "ArchitectureReviewEmailOutbox"("leadLogId");
CREATE INDEX "ArchitectureReviewEmailOutbox_status_idx" ON "ArchitectureReviewEmailOutbox"("status");

ALTER TABLE "ArchitectureReviewEmailOutbox"
ADD CONSTRAINT "ArchitectureReviewEmailOutbox_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ArchitectureReviewJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ArchitectureReviewEmailOutbox"
ADD CONSTRAINT "ArchitectureReviewEmailOutbox_leadLogId_fkey" FOREIGN KEY ("leadLogId") REFERENCES "LeadLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EstimateCompanion" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "source" TEXT NOT NULL,
  "sourceRecordKey" TEXT,
  "sourceLabel" TEXT NOT NULL,
  "provider" TEXT,
  "status" TEXT NOT NULL,
  "referenceCode" TEXT NOT NULL,
  "customerEmail" TEXT NOT NULL,
  "customerName" TEXT,
  "companyName" TEXT,
  "amountUsd" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "externalId" TEXT,
  "externalNumber" TEXT,
  "externalUrl" TEXT,
  "externalPdfUrl" TEXT,
  "summary" TEXT,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EstimateCompanion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EstimateCompanion_referenceCode_key" ON "EstimateCompanion"("referenceCode");
CREATE INDEX "EstimateCompanion_userId_createdAt_idx" ON "EstimateCompanion"("userId", "createdAt");
CREATE INDEX "EstimateCompanion_customerEmail_createdAt_idx" ON "EstimateCompanion"("customerEmail", "createdAt");
CREATE INDEX "EstimateCompanion_source_sourceRecordKey_idx" ON "EstimateCompanion"("source", "sourceRecordKey");
CREATE INDEX "EstimateCompanion_status_updatedAt_idx" ON "EstimateCompanion"("status", "updatedAt");

ALTER TABLE "EstimateCompanion"
ADD CONSTRAINT "EstimateCompanion_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

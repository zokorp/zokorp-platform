CREATE TABLE "LeadInteraction" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "userId" TEXT,
  "serviceRequestId" TEXT,
  "source" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "provider" TEXT,
  "externalEventId" TEXT,
  "estimateReferenceCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadInteraction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadInteraction_externalEventId_key" ON "LeadInteraction"("externalEventId");
CREATE INDEX "LeadInteraction_leadId_createdAt_idx" ON "LeadInteraction"("leadId", "createdAt");
CREATE INDEX "LeadInteraction_userId_idx" ON "LeadInteraction"("userId");
CREATE INDEX "LeadInteraction_serviceRequestId_idx" ON "LeadInteraction"("serviceRequestId");
CREATE INDEX "LeadInteraction_source_action_createdAt_idx" ON "LeadInteraction"("source", "action", "createdAt");

ALTER TABLE "LeadInteraction" ADD CONSTRAINT "LeadInteraction_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadInteraction" ADD CONSTRAINT "LeadInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadInteraction" ADD CONSTRAINT "LeadInteraction_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."LeadInteraction" ENABLE ROW LEVEL SECURITY;

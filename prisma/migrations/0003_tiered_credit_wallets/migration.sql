-- CreateEnum
CREATE TYPE "CreditTier" AS ENUM ('FTR', 'SDP_SRP', 'COMPETENCY', 'GENERAL');

-- AlterTable
ALTER TABLE "Price" ADD COLUMN "creditTier" "CreditTier" NOT NULL DEFAULT 'GENERAL';

-- Backfill validator price tiers by configured amount
UPDATE "Price" p
SET "creditTier" = CASE
  WHEN p."amount" = 5000 THEN 'FTR'::"CreditTier"
  WHEN p."amount" = 15000 THEN 'SDP_SRP'::"CreditTier"
  WHEN p."amount" = 50000 THEN 'COMPETENCY'::"CreditTier"
  ELSE 'GENERAL'::"CreditTier"
END
FROM "Product" prod
WHERE p."productId" = prod."id"
  AND prod."slug" = 'zokorp-validator'
  AND p."kind" = 'CREDIT_PACK';

-- CreateTable
CREATE TABLE "CreditBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tier" "CreditTier" NOT NULL,
    "remainingUses" INTEGER NOT NULL DEFAULT 0,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditBalance_userId_productId_idx" ON "CreditBalance"("userId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditBalance_userId_productId_tier_key" ON "CreditBalance"("userId", "productId", "tier");

-- AddForeignKey
ALTER TABLE "CreditBalance" ADD CONSTRAINT "CreditBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBalance" ADD CONSTRAINT "CreditBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Transitional backfill: move existing shared validator credits into GENERAL wallet
INSERT INTO "CreditBalance" ("id", "userId", "productId", "tier", "remainingUses", "status", "createdAt", "updatedAt")
SELECT
  CONCAT('cb_', md5(e."id" || '_general')),
  e."userId",
  e."productId",
  'GENERAL'::"CreditTier",
  e."remainingUses",
  e."status",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Entitlement" e
JOIN "Product" p ON p."id" = e."productId"
WHERE p."slug" = 'zokorp-validator'
  AND e."remainingUses" > 0
ON CONFLICT ("userId", "productId", "tier") DO NOTHING;

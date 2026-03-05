import { db } from "@/lib/db";

type ExistsRow = { exists: boolean };

let ensurePromise: Promise<boolean> | null = null;

async function hasLeadLogTable() {
  const result = await db.$queryRaw<ExistsRow[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'LeadLog'
    ) AS "exists"
  `;

  return result[0]?.exists === true;
}

async function createLeadLogTable() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LeadLog" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "userEmail" TEXT NOT NULL,
      "userName" TEXT,
      "architectureProvider" TEXT NOT NULL,
      "authProvider" TEXT,
      "overallScore" INTEGER NOT NULL,
      "topIssues" TEXT NOT NULL,
      "inputParagraph" TEXT,
      "reportJson" JSONB,
      "workdriveDiagramFileId" TEXT,
      "workdriveReportFileId" TEXT,
      "workdriveUploadStatus" TEXT,
      "syncedToZohoAt" TIMESTAMP(3),
      "zohoRecordId" TEXT,
      "zohoSyncError" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "LeadLog_pkey" PRIMARY KEY ("id")
    )
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "LeadLog_createdAt_idx"
    ON "LeadLog" ("createdAt")
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "LeadLog_userEmail_idx"
    ON "LeadLog" ("userEmail")
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "LeadLog_syncedToZohoAt_idx"
    ON "LeadLog" ("syncedToZohoAt")
  `);

  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'LeadLog_userId_fkey'
      ) THEN
        ALTER TABLE "LeadLog"
        ADD CONSTRAINT "LeadLog_userId_fkey"
        FOREIGN KEY ("userId")
        REFERENCES "User"("id")
        ON DELETE SET NULL
        ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
}

export async function ensureLeadLogSchemaReady() {
  if (ensurePromise) {
    return ensurePromise;
  }

  ensurePromise = (async () => {
    try {
      if (await hasLeadLogTable()) {
        return true;
      }

      await createLeadLogTable();
      return true;
    } catch (error) {
      console.error("Failed to ensure LeadLog schema.", error);
      return false;
    }
  })();

  const ready = await ensurePromise;
  if (!ready) {
    ensurePromise = null;
  }

  return ready;
}

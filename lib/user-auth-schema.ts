import { db } from "@/lib/db";

type ExistsRow = { exists: boolean };

let ensurePromise: Promise<boolean> | null = null;

async function hasUserAuthTable() {
  const result = await db.$queryRaw<ExistsRow[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'UserAuth'
    ) AS "exists"
  `;

  return result[0]?.exists === true;
}

async function createUserAuthTable() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserAuth" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "passwordHash" TEXT NOT NULL,
      "passwordUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
      "lockedUntil" TIMESTAMP(3),
      "resetTokenHash" TEXT,
      "resetTokenExpiresAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "UserAuth_pkey" PRIMARY KEY ("id")
    )
  `);

  await db.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "UserAuth_userId_key"
    ON "UserAuth" ("userId")
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "UserAuth_lockedUntil_idx"
    ON "UserAuth" ("lockedUntil")
  `);

  await db.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "UserAuth_resetTokenExpiresAt_idx"
    ON "UserAuth" ("resetTokenExpiresAt")
  `);

  await db.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'UserAuth_userId_fkey'
      ) THEN
        ALTER TABLE "UserAuth"
        ADD CONSTRAINT "UserAuth_userId_fkey"
        FOREIGN KEY ("userId")
        REFERENCES "User"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
}

export async function ensureUserAuthSchemaReady() {
  if (ensurePromise) {
    return ensurePromise;
  }

  ensurePromise = (async () => {
    try {
      if (await hasUserAuthTable()) {
        return true;
      }

      await createUserAuthTable();
      return true;
    } catch (error) {
      console.error("Failed to ensure UserAuth schema.", error);
      return false;
    }
  })();

  const ready = await ensurePromise;
  if (!ready) {
    ensurePromise = null;
  }

  return ready;
}

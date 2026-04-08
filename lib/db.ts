import { PrismaClient } from "@prisma/client";

import { buildRuntimeDatabaseUrl } from "@/lib/database-url";

declare global {
  var __zokorpPrisma: PrismaClient | undefined;
}

const runtimeDatabaseUrl = buildRuntimeDatabaseUrl(process.env.DATABASE_URL);

export const db =
  global.__zokorpPrisma ??
  new PrismaClient({
    ...(runtimeDatabaseUrl
      ? {
          datasources: {
            db: {
              url: runtimeDatabaseUrl,
            },
          },
        }
      : {}),
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__zokorpPrisma = db;
}

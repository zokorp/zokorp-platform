import { PrismaClient } from "@prisma/client";

declare global {
  var __zokorpPrisma: PrismaClient | undefined;
}

export const db =
  global.__zokorpPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__zokorpPrisma = db;
}

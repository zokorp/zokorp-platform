import { Prisma } from "@prisma/client";

export function isSchemaDriftError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  return error.code === "P2021" || error.code === "P2022";
}

export function isDatabasePoolPressureError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientInitializationError)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("maxclientsinsessionmode") || message.includes("max clients reached");
}

const TRANSIENT_DATABASE_ERROR_PATTERNS = [
  /maxclientsinsessionmode/i,
  /max clients reached/i,
  /too many clients/i,
  /timed out fetching a new connection/i,
  /can't reach database server/i,
] as const;

export function isTransientDatabaseConnectionError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return TRANSIENT_DATABASE_ERROR_PATTERNS.some((pattern) => pattern.test(error.message));
}

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

type ConsumeInput = {
  key: string;
  limit: number;
  windowMs: number;
};

type ConsumeResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type InMemoryBucket = {
  count: number;
  resetAt: number;
};

const MAX_TRANSACTION_RETRIES = 3;
let lastCleanupAt = 0;
const inMemoryBuckets = new Map<string, InMemoryBucket>();

function toRetryAfterSeconds(ms: number) {
  return Math.max(1, Math.ceil(ms / 1000));
}

function isRetryableRateLimitError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

async function maybeCleanupExpiredBuckets(nowMs: number) {
  if (nowMs - lastCleanupAt < 5 * 60 * 1000) {
    return;
  }

  lastCleanupAt = nowMs;

  try {
    await db.rateLimitBucket.deleteMany({
      where: {
        resetAt: {
          lte: new Date(nowMs),
        },
      },
    });
  } catch {
    // Cleanup failures should not block request processing.
  }
}

export function getRequestFingerprint(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const realIp = request.headers.get("x-real-ip") ?? "";
  const candidate = forwardedFor.split(",")[0]?.trim() || realIp.trim();

  if (candidate) {
    return candidate;
  }

  const ua = request.headers.get("user-agent")?.trim() ?? "unknown-agent";
  return `ua:${ua.slice(0, 120)}`;
}

function consumeRateLimitInMemory(input: ConsumeInput): ConsumeResult {
  const nowMs = Date.now();
  const bucket = inMemoryBuckets.get(input.key);

  if (!bucket || bucket.resetAt <= nowMs) {
    inMemoryBuckets.set(input.key, {
      count: 1,
      resetAt: nowMs + input.windowMs,
    });

    return {
      allowed: true,
      remaining: Math.max(0, input.limit - 1),
      retryAfterSeconds: toRetryAfterSeconds(input.windowMs),
    };
  }

  if (bucket.count >= input.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: toRetryAfterSeconds(bucket.resetAt - nowMs),
    };
  }

  bucket.count += 1;
  inMemoryBuckets.set(input.key, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, input.limit - bucket.count),
    retryAfterSeconds: toRetryAfterSeconds(bucket.resetAt - nowMs),
  };
}

export async function consumeRateLimit(input: ConsumeInput): Promise<ConsumeResult> {
  if (!process.env.DATABASE_URL || process.env.NODE_ENV === "test") {
    return consumeRateLimitInMemory(input);
  }

  const nowMs = Date.now();
  const windowResetAt = new Date(nowMs + input.windowMs);

  for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt += 1) {
    try {
      const result = await db.$transaction(
        async (tx) => {
          const bucket = await tx.rateLimitBucket.findUnique({
            where: {
              key: input.key,
            },
          });

          if (!bucket) {
            await tx.rateLimitBucket.create({
              data: {
                key: input.key,
                count: 1,
                resetAt: windowResetAt,
              },
            });

            return {
              allowed: true,
              remaining: Math.max(0, input.limit - 1),
              retryAfterSeconds: toRetryAfterSeconds(input.windowMs),
            } satisfies ConsumeResult;
          }

          const resetAtMs = bucket.resetAt.getTime();
          if (resetAtMs <= nowMs) {
            await tx.rateLimitBucket.update({
              where: {
                key: input.key,
              },
              data: {
                count: 1,
                resetAt: windowResetAt,
              },
            });

            return {
              allowed: true,
              remaining: Math.max(0, input.limit - 1),
              retryAfterSeconds: toRetryAfterSeconds(input.windowMs),
            } satisfies ConsumeResult;
          }

          if (bucket.count >= input.limit) {
            return {
              allowed: false,
              remaining: 0,
              retryAfterSeconds: toRetryAfterSeconds(resetAtMs - nowMs),
            } satisfies ConsumeResult;
          }

          const updated = await tx.rateLimitBucket.update({
            where: {
              key: input.key,
            },
            data: {
              count: {
                increment: 1,
              },
            },
          });

          return {
            allowed: true,
            remaining: Math.max(0, input.limit - updated.count),
            retryAfterSeconds: toRetryAfterSeconds(updated.resetAt.getTime() - nowMs),
          } satisfies ConsumeResult;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      void maybeCleanupExpiredBuckets(nowMs);
      return result;
    } catch (error) {
      if (isRetryableRateLimitError(error) && attempt + 1 < MAX_TRANSACTION_RETRIES) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("RATE_LIMIT_TRANSACTION_RETRY_EXHAUSTED");
}

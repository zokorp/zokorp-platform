import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

type OutboxRow = {
  id: string;
  jobId: string;
  leadLogId: string | null;
  toEmail: string;
  subject: string;
  textBody: string;
  htmlBody: string | null;
  status: string;
  attemptCount: number;
  provider: string | null;
  errorMessage: string | null;
  sentAt: Date | null;
};

const store = vi.hoisted(() => {
  const rows: OutboxRow[] = [];
  let seq = 0;
  return {
    rows,
    reset() {
      rows.length = 0;
      seq = 0;
    },
    findUnique: vi.fn(async ({ where }: { where: { jobId: string } }) => {
      const row = rows.find((entry) => entry.jobId === where.jobId);
      return row ? { ...row } : null;
    }),
    create: vi.fn(async ({ data }: { data: Partial<OutboxRow> & { jobId: string } }) => {
      if (rows.some((entry) => entry.jobId === data.jobId)) {
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        });
      }
      const row: OutboxRow = {
        id: `outbox_${++seq}`,
        leadLogId: null,
        toEmail: "",
        subject: "",
        textBody: "",
        htmlBody: null,
        status: "pending",
        attemptCount: 0,
        provider: null,
        errorMessage: null,
        sentAt: null,
        ...data,
      } as OutboxRow;
      rows.push(row);
      return { ...row };
    }),
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { jobId: string; status?: string };
        data: { status?: string; provider?: string | null; errorMessage?: string | null; attemptCount?: { increment: number } };
      }) => {
        let count = 0;
        for (const row of rows) {
          if (row.jobId !== where.jobId) continue;
          if (where.status !== undefined && row.status !== where.status) continue;
          if (data.status !== undefined) row.status = data.status;
          if (data.provider !== undefined) row.provider = data.provider;
          if (data.errorMessage !== undefined) row.errorMessage = data.errorMessage;
          if (data.attemptCount?.increment) row.attemptCount += data.attemptCount.increment;
          count += 1;
        }
        return { count };
      },
    ),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    architectureReviewEmailOutbox: {
      findUnique: store.findUnique,
      create: store.create,
      updateMany: store.updateMany,
    },
  },
}));

import {
  claimEmailOutboxForSending,
  ensureEmailOutbox,
  resumeSendResultFromOutbox,
} from "@/lib/architecture-review/email-outbox";

// Mimics the worker's delivery sequence: ensure the (unique) outbox row, claim it, and only call the
// provider when this invocation won the claim. A re-run resumes from the recorded outbox state.
async function deliver(jobId: string, send: () => Promise<{ ok: boolean; provider: string | null }>) {
  await ensureEmailOutbox({
    jobId,
    leadLogId: null,
    toEmail: "owner@acmecloud.com",
    subject: "Architecture review",
    textBody: "body",
    htmlBody: "<p>body</p>",
  });
  const maySend = await claimEmailOutboxForSending(jobId);
  if (maySend) {
    return { maySend, result: await send() };
  }
  const current = await store.findUnique({ where: { jobId } });
  return { maySend, result: resumeSendResultFromOutbox(current!) };
}

describe("architecture review email outbox idempotency (REL-01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.reset();
  });

  it("does not re-send the report email after a post-send crash", async () => {
    const send = vi.fn(async () => ({ ok: true, provider: "resend" as const }));

    // Run 1: wins the claim and calls the provider, then "crashes" before marking the row sent
    // (the row stays in the "sending" state the claim set).
    const run1 = await deliver("job_1", send);
    expect(run1.maySend).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);

    // Run 2 (the worker re-queues and re-runs): must NOT call the provider again.
    const run2 = await deliver("job_1", send);
    expect(run2.maySend).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    expect(run2.result.ok).toBe(true); // resumed as already-delivered

    // Exactly one outbox row exists for the job, attempted once.
    const jobRows = store.rows.filter((row) => row.jobId === "job_1");
    expect(jobRows).toHaveLength(1);
    expect(jobRows[0]?.attemptCount).toBe(1);
  });

  it("lets only one of two concurrent claims call the provider", async () => {
    await ensureEmailOutbox({
      jobId: "job_2",
      leadLogId: null,
      toEmail: "owner@acmecloud.com",
      subject: "s",
      textBody: "t",
      htmlBody: null,
    });

    const [a, b] = await Promise.all([
      claimEmailOutboxForSending("job_2"),
      claimEmailOutboxForSending("job_2"),
    ]);

    expect([a, b].filter(Boolean)).toHaveLength(1);
  });

  it("returns the existing row when a create races with another worker (P2002)", async () => {
    // Simulate a race: our findUnique sees no row, but a concurrent insert lands before our create,
    // so create throws P2002 and ensureEmailOutbox must recover by re-reading the row.
    store.rows.push({
      id: "outbox_pre",
      jobId: "job_3",
      leadLogId: null,
      toEmail: "owner@acmecloud.com",
      subject: "s",
      textBody: "t",
      htmlBody: null,
      status: "pending",
      attemptCount: 0,
      provider: null,
      errorMessage: null,
      sentAt: null,
    });
    store.findUnique.mockResolvedValueOnce(null);

    const row = await ensureEmailOutbox({
      jobId: "job_3",
      leadLogId: null,
      toEmail: "owner@acmecloud.com",
      subject: "s",
      textBody: "t",
      htmlBody: null,
    });

    expect(row.id).toBe("outbox_pre");
    expect(store.rows.filter((entry) => entry.jobId === "job_3")).toHaveLength(1);
  });
});

import { describe, expect, it } from "vitest";

import { buildRuntimeDatabaseUrl } from "@/lib/database-url";

describe("buildRuntimeDatabaseUrl", () => {
  it("keeps local postgres URLs unchanged", () => {
    expect(
      buildRuntimeDatabaseUrl("postgresql://postgres:postgres@localhost:5432/zokorp_platform?schema=public"),
    ).toBe("postgresql://postgres:postgres@localhost:5432/zokorp_platform?schema=public");
  });

  it("caps Supabase session pooler URLs to a single Prisma connection", () => {
    expect(
      buildRuntimeDatabaseUrl(
        "postgresql://postgres.project:secret@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require",
      ),
    ).toBe(
      "postgresql://postgres.project:secret@aws-0-us-west-2.pooler.supabase.com:5432/postgres?sslmode=require&connection_limit=1",
    );
  });

  it("adds Prisma-compatible transaction-pooler parameters for Supabase pooled URLs", () => {
    expect(
      buildRuntimeDatabaseUrl(
        "postgresql://postgres.project:secret@aws-0-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require",
      ),
    ).toBe(
      "postgresql://postgres.project:secret@aws-0-us-west-2.pooler.supabase.com:6543/postgres?sslmode=require&connection_limit=1&pgbouncer=true",
    );
  });

  it("returns null for empty values", () => {
    expect(buildRuntimeDatabaseUrl(" \n ")).toBeNull();
  });
});

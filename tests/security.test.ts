import { describe, expect, it } from "vitest";

import { isAllowedFileType, maxUploadBytes, parseAdminEmails } from "@/lib/security";

describe("security helpers", () => {
  it("parses comma-separated admin emails", () => {
    const emails = parseAdminEmails("admin@zokorp.com, owner@zokorp.com  , ");

    expect(emails.has("admin@zokorp.com")).toBe(true);
    expect(emails.has("owner@zokorp.com")).toBe(true);
    expect(emails.size).toBe(2);
  });

  it("validates upload type by extension + MIME", () => {
    expect(isAllowedFileType("doc.pdf", "application/pdf")).toBe(true);
    expect(
      isAllowedFileType(
        "sheet.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe(true);
    expect(isAllowedFileType("script.exe", "application/octet-stream")).toBe(false);
  });

  it("returns byte limits from configured MB", () => {
    expect(maxUploadBytes(1)).toBe(1024 * 1024);
    expect(maxUploadBytes(undefined)).toBe(10 * 1024 * 1024);
  });
});

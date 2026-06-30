import { describe, expect, it } from "vitest";

import { escapeCsv } from "@/lib/validator-control-review";

describe("edit-guide CSV formula injection (VAL-03)", () => {
  it("prefixes ASCII formula-trigger cells with a single quote", () => {
    expect(escapeCsv("=cmd()")).toBe("'=cmd()");
    expect(escapeCsv("+1+1")).toBe("'+1+1");
    expect(escapeCsv("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsv("-2+3")).toBe("'-2+3");
  });

  it("neutralizes tab/CR-led and full-width triggers", () => {
    // Tab-led: prefixed AND quoted (contains a tab).
    expect(escapeCsv("\t=danger")).toBe("\"'\t=danger\"");
    // Full-width equals normalizes back to a formula in some clients.
    expect(escapeCsv("＝1+2")).toBe("'＝1+2");
  });

  it("quotes separators so a value cannot start a new cell mid-field", () => {
    expect(escapeCsv("a,b")).toBe('"a,b"');
    expect(escapeCsv('he said "hi"')).toBe('"he said ""hi"""');
    expect(escapeCsv("line1\r\nline2").startsWith('"')).toBe(true);
  });

  it("leaves safe values unchanged", () => {
    expect(escapeCsv("Normal requirement text")).toBe("Normal requirement text");
    expect(escapeCsv("B12")).toBe("B12");
    expect(escapeCsv("")).toBe("");
  });
});

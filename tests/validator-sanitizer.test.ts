import { describe, expect, it } from "vitest";

import { sanitizeValidatorText } from "@/lib/validator-sanitizer";

describe("validator sanitizer", () => {
  it("redacts common sensitive values", () => {
    const sample = [
      "Contact: jane.doe@example.com",
      "Phone: (201) 555-0123",
      "SSN: 123-45-6789",
      "Account: 0012345678901234",
      "Card: 4242 4242 4242 4242",
    ].join("\n");

    const sanitized = sanitizeValidatorText(sample);

    expect(sanitized.text).not.toContain("jane.doe@example.com");
    expect(sanitized.text).not.toContain("123-45-6789");
    expect(sanitized.text).toContain("[REDACTED_EMAIL]");
    expect(sanitized.text).toContain("[REDACTED_PHONE]");
    expect(sanitized.text).toContain("[REDACTED_SSN]");
    expect(sanitized.counts.emails).toBeGreaterThan(0);
    expect(sanitized.notes.length).toBeGreaterThan(0);
  });

  it("keeps notes empty when no sensitive values are present", () => {
    const sanitized = sanitizeValidatorText("Architecture scope and testing evidence are included.");

    expect(sanitized.notes.length).toBe(0);
  });
});

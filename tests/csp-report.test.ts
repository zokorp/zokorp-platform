import { describe, expect, it } from "vitest";

import { extractCspViolationReports, parseCspReportBody } from "@/lib/csp-report";

describe("CSP report helpers", () => {
  it("normalizes legacy browser reports and strips sensitive URL parts", () => {
    const reports = extractCspViolationReports({
      "csp-report": {
        "document-uri": "https://app.zokorp.com/account?token=secret#billing",
        "blocked-uri": "https://www.googletagmanager.com/gtag/js?id=G-TEST123",
        "effective-directive": "script-src-elem",
        "violated-directive": "script-src-elem",
        "source-file": "https://app.zokorp.com/_next/static/chunks/app.js?cache=1",
        referrer: "https://www.google.com/search?q=zokorp",
        "status-code": 200,
        "line-number": 18,
        "column-number": 5,
        "script-sample": "window.__secret = 'keep out';",
      },
    });

    expect(reports).toEqual([
      {
        blockedUri: "https://www.googletagmanager.com/gtag/js",
        columnNumber: 5,
        disposition: null,
        documentUri: "https://app.zokorp.com/account",
        effectiveDirective: "script-src-elem",
        lineNumber: 18,
        referrer: "https://www.google.com/search",
        sample: "window.__secret = 'keep out';",
        sourceFile: "https://app.zokorp.com/_next/static/chunks/app.js",
        statusCode: 200,
        violatedDirective: "script-src-elem",
      },
    ]);
  });

  it("accepts reporting api payloads", () => {
    const reports = parseCspReportBody(
      JSON.stringify([
        {
          type: "csp-violation",
          url: "https://app.zokorp.com/software/zokorp-validator?trial=1",
          body: {
            blockedURL: "inline",
            disposition: "enforce",
            effectiveDirective: "script-src",
            lineNumber: 12,
            columnNumber: 4,
            sample: "alert(1)",
          },
        },
      ]),
    );

    expect(reports).toEqual([
      {
        blockedUri: "inline",
        columnNumber: 4,
        disposition: "enforce",
        documentUri: "https://app.zokorp.com/software/zokorp-validator",
        effectiveDirective: "script-src",
        lineNumber: 12,
        referrer: null,
        sample: "alert(1)",
        sourceFile: null,
        statusCode: null,
        violatedDirective: "script-src",
      },
    ]);
  });

  it("drops invalid or oversized bodies", () => {
    expect(parseCspReportBody("not-json")).toEqual([]);
    expect(parseCspReportBody(" ".repeat(5))).toEqual([]);
    expect(parseCspReportBody(`{"csp-report":${"x".repeat(20_000)}}`)).toEqual([]);
  });
});

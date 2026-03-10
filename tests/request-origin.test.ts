import { describe, expect, it } from "vitest";

import { extractRequestOrigin, requireSameOrigin } from "@/lib/request-origin";

describe("request origin guard", () => {
  it("accepts same-origin origin headers", async () => {
    const request = new Request("https://app.zokorp.com/api/test", {
      method: "POST",
      headers: {
        origin: "https://app.zokorp.com",
      },
    });

    expect(requireSameOrigin(request)).toBeNull();
  });

  it("falls back to referer origin when origin is absent", async () => {
    const request = new Request("https://app.zokorp.com/api/test", {
      method: "POST",
      headers: {
        referer: "https://app.zokorp.com/software/architecture-diagram-reviewer",
      },
    });

    expect(extractRequestOrigin(request)).toEqual({
      present: true,
      origin: "https://app.zokorp.com",
    });
    expect(requireSameOrigin(request)).toBeNull();
  });

  it("rejects missing origin metadata", async () => {
    const request = new Request("https://app.zokorp.com/api/test", {
      method: "POST",
    });

    const response = requireSameOrigin(request);
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: "Cross-site requests are not allowed.",
    });
  });

  it("rejects cross-site origins", async () => {
    const request = new Request("https://app.zokorp.com/api/test", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
      },
    });

    const response = requireSameOrigin(request);
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: "Cross-site requests are not allowed.",
    });
  });
});

import { describe, expect, it } from "vitest";

import { isDeniedIp, SsrfBlockedError, ssrfSafeFetch } from "@/lib/ssrf-safe-fetch";

describe("SSRF IP deny ranges (SEC-03)", () => {
  it("denies cloud metadata endpoints", () => {
    for (const ip of ["169.254.169.254", "169.254.170.2", "192.0.0.192", "100.100.100.200"]) {
      expect(isDeniedIp(ip), ip).toBe(true);
    }
  });

  it("denies private, loopback, and link-local IPv4 ranges", () => {
    for (const ip of ["10.0.0.5", "172.16.4.4", "192.168.1.1", "127.0.0.1", "169.254.10.10", "0.0.0.0", "100.64.0.1"]) {
      expect(isDeniedIp(ip), ip).toBe(true);
    }
  });

  it("denies loopback, unique-local, link-local, and multicast IPv6", () => {
    for (const ip of ["::1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1"]) {
      expect(isDeniedIp(ip), ip).toBe(true);
    }
  });

  it("allows public IPs", () => {
    for (const ip of ["1.1.1.1", "8.8.8.8", "203.0.113.10", "2606:4700:4700::1111"]) {
      expect(isDeniedIp(ip), ip).toBe(false);
    }
  });
});

describe("ssrfSafeFetch guards (SEC-03)", () => {
  it("rejects a host outside the allowlist before any network call", async () => {
    await expect(
      ssrfSafeFetch("https://internal.evil.example/secret", { isHostAllowed: () => false }),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("rejects a literal metadata IP even when the host check would allow it", async () => {
    await expect(
      ssrfSafeFetch("http://169.254.169.254/latest/meta-data/", { isHostAllowed: () => true }),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("rejects non-http(s) protocols", async () => {
    await expect(
      ssrfSafeFetch("file:///etc/passwd", { isHostAllowed: () => true }),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });
});

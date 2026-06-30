import dns from "node:dns";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

// SEC-03 (VAL-01): SSRF-hardened GET for the validator reference fetcher. The destination set is
// code-owned (cloud documentation hosts), so a HOST ALLOWLIST is the primary control. On top of that
// we add defense-in-depth: every hop is re-validated against the allowlist AND its resolved IPs are
// checked against private/link-local/metadata deny ranges, then the connection is PINNED to a
// validated IP (custom undici lookup) so DNS cannot be re-resolved to an internal address between the
// check and the connect (TOCTOU / DNS-rebinding). Redirects are followed manually so an allowed host
// cannot 30x-redirect into an internal target.

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

// IPv4 deny ranges as [networkAddress, prefixBits].
const DENY_IPV4_CIDRS: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // RFC1918 private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local incl. 169.254.169.254 (AWS/Azure IMDS) and 169.254.170.2 (ECS)
  ["172.16.0.0", 12], // RFC1918 private
  ["192.0.0.0", 24], // IETF protocol assignments incl. 192.0.0.192 (Oracle Cloud metadata)
  ["192.168.0.0", 16], // RFC1918 private
  ["198.18.0.0", 15], // benchmarking
  ["100.100.100.0", 24], // Alibaba Cloud metadata 100.100.100.200
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }
  let value = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet < 0 || octet > 255) {
      return null;
    }
    value = (value * 256 + octet) >>> 0;
  }
  return value >>> 0;
}

function isDeniedIpv4(ip: string): boolean {
  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) {
    return true;
  }
  for (const [network, bits] of DENY_IPV4_CIDRS) {
    const netInt = ipv4ToInt(network);
    if (netInt === null) {
      continue;
    }
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((ipInt & mask) >>> 0 === (netInt & mask) >>> 0) {
      return true;
    }
  }
  return false;
}

function isDeniedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().split("%")[0];
  if (normalized === "::1" || normalized === "::") {
    return true;
  }

  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible addresses inherit the IPv4 verdict.
  const mapped = normalized.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) {
    return isDeniedIpv4(mapped[1]);
  }

  const firstHextet = normalized.split(":")[0];
  const value = firstHextet ? Number.parseInt(firstHextet, 16) : Number.NaN;
  if (!Number.isNaN(value)) {
    const firstByte = value >> 8;
    if (firstByte === 0xfc || firstByte === 0xfd) {
      return true; // fc00::/7 unique-local
    }
    if ((value & 0xffc0) === 0xfe80) {
      return true; // fe80::/10 link-local
    }
    if (firstByte === 0xff) {
      return true; // ff00::/8 multicast
    }
  }
  return false;
}

export function isDeniedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    return isDeniedIpv4(ip);
  }
  if (net.isIPv6(ip)) {
    return isDeniedIpv6(ip);
  }
  return true; // unknown shape -> deny
}

const DENIED_HOSTNAMES = new Set(["localhost", "metadata", "metadata.google.internal"]);

function lookupAll(hostname: string): Promise<dns.LookupAddress[]> {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(addresses);
    });
  });
}

// Resolve a hostname (or accept a literal IP), then validate every resolved address against the deny
// ranges. Returns the set of validated public IPs to pin the connection to.
async function resolveAndValidate(hostname: string): Promise<Set<string>> {
  const host = hostname.toLowerCase();
  if (!host || DENIED_HOSTNAMES.has(host)) {
    throw new SsrfBlockedError(`Reference host is not allowed: ${host || "(empty)"}`);
  }

  if (net.isIP(host)) {
    if (isDeniedIp(host)) {
      throw new SsrfBlockedError(`Reference IP is in a denied range: ${host}`);
    }
    return new Set([host]);
  }

  const records = await lookupAll(host);
  if (records.length === 0) {
    throw new SsrfBlockedError(`No DNS records resolved for ${host}`);
  }
  for (const record of records) {
    if (isDeniedIp(record.address)) {
      throw new SsrfBlockedError(`Resolved IP for ${host} is in a denied range: ${record.address}`);
    }
  }
  return new Set(records.map((record) => record.address));
}

// An undici dispatcher whose connect-time DNS lookup only returns a pre-validated public IP. This
// re-validates at connect time (closing the check->connect window) while undici still uses the
// original hostname for TLS SNI and the Host header.
function pinnedDispatcher(validatedIps: Set<string>): Agent {
  return new Agent({
    connect: {
      lookup(hostname, _options, callback) {
        dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
          if (error) {
            callback(error, "", 0);
            return;
          }
          const pick = addresses.find((entry) => validatedIps.has(entry.address) && !isDeniedIp(entry.address));
          if (!pick) {
            callback(
              new SsrfBlockedError(`Connect-time DNS for ${hostname} did not match a validated public IP`),
              "",
              0,
            );
            return;
          }
          callback(null, pick.address, pick.family);
        });
      },
    },
  });
}

export type SsrfSafeFetchOptions = {
  isHostAllowed: (host: string) => boolean;
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
};

export type SsrfSafeResponse = {
  status: number;
  contentType: string;
  text: string;
};

// SSRF-safe GET: allowlist + IP deny ranges + connect-time IP pinning + manual redirects + size and
// time caps. Throws SsrfBlockedError when any control rejects the request.
export async function ssrfSafeFetch(rawUrl: string, options: SsrfSafeFetchOptions): Promise<SsrfSafeResponse> {
  const { isHostAllowed, timeoutMs = 4500, maxRedirects = 4, maxBytes = 2_000_000 } = options;

  let currentUrl = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      throw new SsrfBlockedError(`Invalid reference URL: ${currentUrl}`);
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new SsrfBlockedError(`Reference URL protocol is not allowed: ${parsed.protocol}`);
    }

    const host = parsed.hostname.toLowerCase();
    // PRIMARY control: every hop's host must be on the code-owned allowlist.
    if (!isHostAllowed(host)) {
      throw new SsrfBlockedError(`Reference host is outside the allowed documentation policy: ${host}`);
    }

    // Defense in depth: resolve + validate the IPs, then pin the connection to them.
    const validatedIps = await resolveAndValidate(host);
    const dispatcher = pinnedDispatcher(validatedIps);

    let response: Awaited<ReturnType<typeof undiciFetch>>;
    try {
      response = await undiciFetch(parsed.toString(), {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "text/html,text/plain,application/json" },
        dispatcher,
      });
    } finally {
      await dispatcher.close().catch(() => {});
    }

    // Manual redirect handling so each hop is re-validated by the loop above.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new SsrfBlockedError(`Redirect without a Location header from ${host}`);
      }
      currentUrl = new URL(location, parsed).toString();
      continue;
    }

    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      throw new SsrfBlockedError(`Reference response too large (${contentLength} bytes) from ${host}`);
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const raw = await response.text();
    return {
      status: response.status,
      contentType,
      text: raw.length > maxBytes ? raw.slice(0, maxBytes) : raw,
    };
  }

  throw new SsrfBlockedError(`Too many redirects fetching ${rawUrl}`);
}

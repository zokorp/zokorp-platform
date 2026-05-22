import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchWithTimeoutMock = vi.hoisted(() => vi.fn());
const sendMailMock = vi.hoisted(() => vi.fn());
const createTransportMock = vi.hoisted(() => vi.fn(() => ({ sendMail: sendMailMock })));

vi.mock("@/lib/http", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http")>("@/lib/http");
  return {
    ...actual,
    fetchWithTimeout: fetchWithTimeoutMock,
  };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: createTransportMock,
  },
}));

import { sendArchitectureReviewEmail } from "@/lib/architecture-review/sender";

const SAMPLE_INPUT = {
  to: "buyer@example.com",
  subject: "Your architecture review is ready",
  text: "plain text body",
  html: "<p>html body</p>",
};

function okResponse(body: unknown = { id: "ok" }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function errResponse(status: number, message = "denied") {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("sendArchitectureReviewEmail provider preference", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Strip any provider env so each test composes its own scenario.
    delete process.env.ZEPTOMAIL_TOKEN;
    delete process.env.ZEPTOMAIL_FROM_EMAIL;
    delete process.env.ZEPTOMAIL_FROM_NAME;
    delete process.env.ZEPTOMAIL_API_URL;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.EMAIL_SERVER_HOST;
    delete process.env.EMAIL_SERVER_PORT;
    delete process.env.EMAIL_SERVER_USER;
    delete process.env.EMAIL_SERVER_PASSWORD;
    delete process.env.EMAIL_FROM;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("prefers ZeptoMail when its env vars are set", async () => {
    process.env.ZEPTOMAIL_TOKEN = "z-token";
    process.env.ZEPTOMAIL_FROM_EMAIL = "hello@zokorp.com";
    process.env.RESEND_API_KEY = "re_should_not_be_used";
    process.env.RESEND_FROM_EMAIL = "noreply@zokorp.com";

    fetchWithTimeoutMock.mockResolvedValueOnce(okResponse());

    const result = await sendArchitectureReviewEmail(SAMPLE_INPUT);

    expect(result.ok).toBe(true);
    expect(result.provider).toBe("zeptomail");
    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchWithTimeoutMock.mock.calls[0];
    expect(url).toBe("https://api.zeptomail.com/v1.1/email");
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Zoho-enczapikey z-token");
    const body = JSON.parse(((init as RequestInit).body as string) ?? "{}");
    expect(body.from.address).toBe("hello@zokorp.com");
    expect(body.to[0].email_address.address).toBe("buyer@example.com");
    expect(body.subject).toBe(SAMPLE_INPUT.subject);
    expect(body.textbody).toBe(SAMPLE_INPUT.text);
    expect(body.htmlbody).toBe(SAMPLE_INPUT.html);
  });

  it("honors a custom ZEPTOMAIL_API_URL for regional endpoints", async () => {
    process.env.ZEPTOMAIL_TOKEN = "z-token";
    process.env.ZEPTOMAIL_FROM_EMAIL = "hello@zokorp.com";
    process.env.ZEPTOMAIL_API_URL = "https://api.zeptomail.eu/v1.1/email";

    fetchWithTimeoutMock.mockResolvedValueOnce(okResponse());

    await sendArchitectureReviewEmail(SAMPLE_INPUT);

    expect(fetchWithTimeoutMock.mock.calls[0][0]).toBe("https://api.zeptomail.eu/v1.1/email");
  });

  it("falls back to Resend when ZeptoMail returns a non-2xx response", async () => {
    process.env.ZEPTOMAIL_TOKEN = "z-token";
    process.env.ZEPTOMAIL_FROM_EMAIL = "hello@zokorp.com";
    process.env.RESEND_API_KEY = "re_fallback";
    process.env.RESEND_FROM_EMAIL = "noreply@zokorp.com";

    fetchWithTimeoutMock
      .mockResolvedValueOnce(errResponse(500, "server fire"))
      .mockResolvedValueOnce(okResponse());

    const result = await sendArchitectureReviewEmail(SAMPLE_INPUT);

    expect(result.ok).toBe(true);
    expect(result.provider).toBe("resend");
    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(2);
    expect(fetchWithTimeoutMock.mock.calls[1][0]).toBe("https://api.resend.com/emails");
  });

  it("skips ZeptoMail entirely when token is not configured and goes straight to Resend", async () => {
    process.env.RESEND_API_KEY = "re_only";
    process.env.RESEND_FROM_EMAIL = "noreply@zokorp.com";

    fetchWithTimeoutMock.mockResolvedValueOnce(okResponse());

    const result = await sendArchitectureReviewEmail(SAMPLE_INPUT);

    expect(result.ok).toBe(true);
    expect(result.provider).toBe("resend");
    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(1);
    expect(fetchWithTimeoutMock.mock.calls[0][0]).toBe("https://api.resend.com/emails");
  });

  it("falls all the way through to SMTP when both REST providers fail", async () => {
    process.env.ZEPTOMAIL_TOKEN = "z-token";
    process.env.ZEPTOMAIL_FROM_EMAIL = "hello@zokorp.com";
    process.env.RESEND_API_KEY = "re_will_fail";
    process.env.RESEND_FROM_EMAIL = "noreply@zokorp.com";
    process.env.EMAIL_SERVER_HOST = "smtp.example.com";
    process.env.EMAIL_SERVER_PORT = "587";
    process.env.EMAIL_SERVER_USER = "user";
    process.env.EMAIL_SERVER_PASSWORD = "pass";
    process.env.EMAIL_FROM = "hello@zokorp.com";

    fetchWithTimeoutMock
      .mockResolvedValueOnce(errResponse(401, "bad token"))
      .mockResolvedValueOnce(errResponse(500, "resend fire"));
    sendMailMock.mockResolvedValueOnce({ rejected: [], pending: [] });

    const result = await sendArchitectureReviewEmail(SAMPLE_INPUT);

    expect(result.ok).toBe(true);
    expect(result.provider).toBe("smtp");
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it("returns a combined error when every provider fails", async () => {
    process.env.ZEPTOMAIL_TOKEN = "z-token";
    process.env.ZEPTOMAIL_FROM_EMAIL = "hello@zokorp.com";
    process.env.RESEND_API_KEY = "re_will_fail";
    process.env.RESEND_FROM_EMAIL = "noreply@zokorp.com";
    process.env.EMAIL_SERVER_HOST = "smtp.example.com";
    process.env.EMAIL_SERVER_PORT = "587";
    process.env.EMAIL_SERVER_USER = "user";
    process.env.EMAIL_SERVER_PASSWORD = "pass";
    process.env.EMAIL_FROM = "hello@zokorp.com";

    fetchWithTimeoutMock
      .mockResolvedValueOnce(errResponse(401, "bad token"))
      .mockResolvedValueOnce(errResponse(500, "resend fire"));
    sendMailMock.mockRejectedValueOnce(new Error("connection refused"));

    const result = await sendArchitectureReviewEmail(SAMPLE_INPUT);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("ZEPTOMAIL_401");
    expect(result.error).toContain("RESEND_500");
    expect(result.error).toContain("connection refused");
  });

  it("returns a not-configured error when no provider has env vars set", async () => {
    const result = await sendArchitectureReviewEmail(SAMPLE_INPUT);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("ZEPTOMAIL_NOT_CONFIGURED");
    expect(result.error).toContain("RESEND_NOT_CONFIGURED");
    expect(result.error).toContain("SMTP_NOT_CONFIGURED");
  });

  it("uses a custom from name when ZEPTOMAIL_FROM_NAME is set", async () => {
    process.env.ZEPTOMAIL_TOKEN = "z-token";
    process.env.ZEPTOMAIL_FROM_EMAIL = "hello@zokorp.com";
    process.env.ZEPTOMAIL_FROM_NAME = "ZoKorp Reviews";

    fetchWithTimeoutMock.mockResolvedValueOnce(okResponse());

    await sendArchitectureReviewEmail(SAMPLE_INPUT);

    const init = fetchWithTimeoutMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse((init.body as string) ?? "{}");
    expect(body.from.name).toBe("ZoKorp Reviews");
  });
});

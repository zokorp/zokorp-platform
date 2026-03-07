import nodemailer from "nodemailer";
import { FetchTimeoutError, fetchWithTimeout, readResponseBodySnippet } from "@/lib/http";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendEmailResult = {
  ok: boolean;
  provider: "resend" | "smtp" | null;
  error?: string;
};

async function sendWithResend(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return {
      ok: false,
      provider: null,
      error: "RESEND_NOT_CONFIGURED",
    };
  }

  try {
    const response = await fetchWithTimeout(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
      },
      12_000,
    );

    if (!response.ok) {
      const errorBody = readResponseBodySnippet(await response.text(), 400);
      return {
        ok: false,
        provider: "resend",
        error: `RESEND_${response.status}:${errorBody}`,
      };
    }

    return {
      ok: true,
      provider: "resend",
    };
  } catch (error) {
    if (error instanceof FetchTimeoutError) {
      return {
        ok: false,
        provider: "resend",
        error: "RESEND_TIMEOUT",
      };
    }

    return {
      ok: false,
      provider: "resend",
      error: error instanceof Error ? error.message : "RESEND_UNKNOWN_ERROR",
    };
  }
}

async function sendWithSmtp(input: SendEmailInput): Promise<SendEmailResult> {
  const host = process.env.EMAIL_SERVER_HOST;
  const port = process.env.EMAIL_SERVER_PORT;
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;
  const from = process.env.EMAIL_FROM;

  if (!host || !port || !user || !pass || !from) {
    return {
      ok: false,
      provider: null,
      error: "SMTP_NOT_CONFIGURED",
    };
  }

  try {
    const transport = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      tls: {
        minVersion: "TLSv1.2",
      },
    });

    const result = await transport.sendMail({
      to: input.to,
      from,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    const failed = [...(result.rejected ?? []), ...(result.pending ?? [])].filter(Boolean);
    if (failed.length > 0) {
      return {
        ok: false,
        provider: "smtp",
        error: `SMTP_REJECTED:${failed.join(",")}`,
      };
    }

    return {
      ok: true,
      provider: "smtp",
    };
  } catch (error) {
    return {
      ok: false,
      provider: "smtp",
      error: error instanceof Error ? error.message : "SMTP_UNKNOWN_ERROR",
    };
  }
}

export async function sendArchitectureReviewEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resendResult = await sendWithResend(input);
  if (resendResult.ok) {
    return resendResult;
  }

  const smtpResult = await sendWithSmtp(input);
  if (smtpResult.ok) {
    return smtpResult;
  }

  return {
    ok: false,
    provider: resendResult.provider ?? smtpResult.provider,
    error: [resendResult.error, smtpResult.error].filter(Boolean).join(" | "),
  };
}

export async function sendToolResultEmail(input: SendEmailInput): Promise<SendEmailResult> {
  return sendArchitectureReviewEmail(input);
}

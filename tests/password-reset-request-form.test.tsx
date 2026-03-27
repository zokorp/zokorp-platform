/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PasswordResetRequestForm } from "@/components/password-reset-request-form";

describe("PasswordResetRequestForm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        message: "If that account exists, a reset email has been sent.",
      }),
    }));

    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("switches into a clear success state after requesting a reset link", async () => {
    render(<PasswordResetRequestForm />);

    fireEvent.change(screen.getByLabelText(/business email/i), {
      target: { value: "zkhawaja+atlas3@zokorp.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => expect(screen.getByText(/reset email requested/i)).toBeTruthy());
    expect(screen.getByText(/if that account exists, a reset email has been sent/i)).toBeTruthy();
    expect(screen.getByText(/requested for: zkhawaja\+atlas3@zokorp\.com/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /send reset link/i })).toBeNull();
    expect(screen.getByRole("button", { name: /send another reset link/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /send another reset link/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /send reset link/i })).toBeTruthy());
  });
});

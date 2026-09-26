import { afterEach, describe, expect, test, vi } from "vitest";

import {
  requestCustomerPasswordReset,
  resetCustomerPassword,
} from "../lib/customer/password-reset";

function authStub(resetOutcome: "reset" | "invalid" = "reset") {
  return {
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue(resetOutcome),
  };
}

const validReset = {
  token: "reset-token",
  password: "Sup3r-secret",
  confirmPassword: "Sup3r-secret",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Requesting a password reset", () => {
  test("gives the same reply for an email of a Customer and one without", async () => {
    const known = await requestCustomerPasswordReset("jane@example.com", {
      auth: authStub(),
    });
    const unknown = await requestCustomerPasswordReset("nobody@example.com", {
      auth: authStub(),
    });

    expect(known).toEqual(unknown);
    expect(known).toEqual({ status: "requested" });
  });

  test("gives the same reply when sending fails, so a failure cannot reveal a Customer", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const auth = authStub();
    auth.requestPasswordReset.mockRejectedValue(new Error("mail is down"));

    await expect(
      requestCustomerPasswordReset("jane@example.com", { auth }),
    ).resolves.toEqual({ status: "requested" });
    expect(console.error).toHaveBeenCalled();
  });

  test("asks Neon with a normalised email", async () => {
    const auth = authStub();

    await requestCustomerPasswordReset("  Jane@Example.com ", { auth });

    expect(auth.requestPasswordReset).toHaveBeenCalledWith("jane@example.com");
  });

  test("rejects a malformed email without asking Neon", async () => {
    const auth = authStub();

    await expect(
      requestCustomerPasswordReset("not-an-email", { auth }),
    ).resolves.toEqual({
      status: "invalid-email",
      message: "Enter a valid email address",
    });
    expect(auth.requestPasswordReset).not.toHaveBeenCalled();
  });
});

describe("Resetting a password", () => {
  test("sets the new password with the link's token", async () => {
    const auth = authStub();

    await expect(resetCustomerPassword(validReset, { auth })).resolves.toEqual({
      status: "reset",
    });
    expect(auth.resetPassword).toHaveBeenCalledWith({
      token: "reset-token",
      newPassword: "Sup3r-secret",
    });
  });

  test.each([
    ["is too short", "Ab1!", "Password must be at least 8 characters"],
    ["has no uppercase letter", "sup3r-secret", "Password must contain at least one uppercase letter"],
    ["has no number", "Super-secret", "Password must contain at least one number"],
    ["has no special character", "Sup3rsecret", "Password must contain at least one special character"],
  ])("rejects a password that %s, following the sign-up rules", async (_rule, password, message) => {
    const auth = authStub();

    await expect(
      resetCustomerPassword(
        { ...validReset, password, confirmPassword: password },
        { auth },
      ),
    ).resolves.toEqual({
      status: "invalid-password",
      fieldErrors: { password: [message] },
    });
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });

  test("rejects a confirmation that does not match", async () => {
    const auth = authStub();

    await expect(
      resetCustomerPassword({ ...validReset, confirmPassword: "Different1!" }, { auth }),
    ).resolves.toEqual({
      status: "invalid-password",
      fieldErrors: { confirmPassword: ["Passwords do not match"] },
    });
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });

  test("rejects an oversized password without asking Neon", async () => {
    const auth = authStub();
    const password = `Aa1!${"a".repeat(200)}`;

    await expect(
      resetCustomerPassword({ ...validReset, password, confirmPassword: password }, { auth }),
    ).resolves.toMatchObject({ status: "invalid-password" });
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });

  test("reports an expired or already-used link", async () => {
    await expect(
      resetCustomerPassword(validReset, { auth: authStub("invalid") }),
    ).resolves.toEqual({ status: "invalid-link" });
  });

  test("treats a missing or oversized token as an invalid link without asking Neon", async () => {
    const auth = authStub();

    await expect(
      resetCustomerPassword({ ...validReset, token: undefined }, { auth }),
    ).resolves.toEqual({ status: "invalid-link" });
    await expect(
      resetCustomerPassword({ ...validReset, token: "" }, { auth }),
    ).resolves.toEqual({ status: "invalid-link" });
    await expect(
      resetCustomerPassword({ ...validReset, token: "a".repeat(5_000) }, { auth }),
    ).resolves.toEqual({ status: "invalid-link" });
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });

  test("checks the password before spending the link", async () => {
    const auth = authStub();

    await resetCustomerPassword(
      { token: "reset-token", password: "weak", confirmPassword: "weak" },
      { auth },
    );

    expect(auth.resetPassword).not.toHaveBeenCalled();
  });
});

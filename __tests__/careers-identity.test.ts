import { describe, expect, test, vi } from "vitest";

import {
  requestApplicantPasswordReset,
  resetApplicantPassword,
  signInApplicant,
  signUpApplicant,
  type ApplicantAuth,
} from "../lib/careers/identity";

function authStub(overrides: Partial<ApplicantAuth> = {}): ApplicantAuth {
  return {
    createLogin: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue("reset"),
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn().mockResolvedValue("signed-in"),
    ...overrides,
  };
}

describe("Applicant identity", () => {
  test("creates an Applicant login and sends that Applicant a verification email", async () => {
    const auth = authStub();

    await expect(signUpApplicant({ firstName: "jane", middleName: "quinn", lastName: "doe", email: "JANE@example.com", password: "Password123!" }, { auth })).resolves.toEqual({ email: "jane@example.com" });
    expect(auth.createLogin).toHaveBeenCalledWith({ name: "Jane Quinn Doe", email: "jane@example.com", password: "Password123!" });
    expect(auth.sendVerificationEmail).toHaveBeenCalledWith("jane@example.com");
  });

  test("composes the name without a middle name when none is given", async () => {
    const auth = authStub();

    await signUpApplicant({ firstName: "jane", middleName: "", lastName: "doe", email: "jane@example.com", password: "Password123!" }, { auth });
    expect(auth.createLogin).toHaveBeenCalledWith({ name: "Jane Doe", email: "jane@example.com", password: "Password123!" });
  });

  test("rejects a name containing characters that aren't part of a name", async () => {
    const auth = authStub();

    await expect(signUpApplicant({ firstName: "Jane123", middleName: "", lastName: "Doe", email: "jane@example.com", password: "Password123!" }, { auth })).rejects.toThrow();
    expect(auth.createLogin).not.toHaveBeenCalled();
  });

  test("keeps invalid credentials and unverified Applicants distinct", async () => {
    const auth = authStub({ signIn: vi.fn().mockResolvedValue("unverified") });

    await expect(signInApplicant({ email: "jane@example.com", password: "password123" }, { auth })).resolves.toEqual({ status: "unverified", email: "jane@example.com" });
    await expect(signInApplicant({ email: "not-an-email", password: "" }, { auth })).resolves.toEqual({ status: "invalid", message: "Enter a valid email and password." });
  });

  test("does not reveal whether an Applicant exists in password reset", async () => {
    const auth = authStub({ requestPasswordReset: vi.fn().mockRejectedValue(new Error("unknown login")) });

    await expect(requestApplicantPasswordReset("jane@example.com", { auth })).resolves.toEqual({ status: "requested" });
  });

  test("does not send a reset token to Auth until the new passwords validate", async () => {
    const auth = authStub();

    await expect(resetApplicantPassword({ token: "reset-token", password: "password123", confirmPassword: "different" }, { auth })).resolves.toMatchObject({ status: "invalid-password" });
    expect(auth.resetPassword).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  requestHeaders,
  signUpCustomer,
  requestCustomerPasswordReset,
  resendCustomerVerification,
} = vi.hoisted(() => ({
  requestHeaders: new Headers(),
  signUpCustomer: vi.fn(),
  requestCustomerPasswordReset: vi.fn(),
  resendCustomerVerification: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));
vi.mock("@/lib/db", () => ({ getDatabase: () => ({}) }));

vi.mock("@/lib/customer/sign-up", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/customer/sign-up")>()),
  signUpCustomer,
}));
vi.mock("@/lib/customer/password-reset", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/customer/password-reset")>()),
  requestCustomerPasswordReset,
}));
vi.mock("@/lib/customer/email-verification", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/customer/email-verification")>()),
  resendCustomerVerification,
}));
vi.mock("@/lib/neon-auth/server", () => ({
  neonAuth: {},
  neonPasswordResetAuth: {},
  neonVerificationAuth: {},
}));

import { submitForgotPassword } from "@/app/(auth)/(signed-out)/forgot-password/actions";
import { submitSignUp } from "@/app/(auth)/(signed-out)/signup/actions";
import { resendVerificationEmail } from "@/app/(site)/verify-email/actions";

function validForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    firstName: "Jane", lastName: "Doe", email: "jane@example.com",
    password: "Password1!", confirmPassword: "Password1!",
    contactNumber: "09171234567", street: "123 Katipunan Avenue",
    barangay: "Loyola Heights", city: "Quezon City", province: "Metro Manila",
    postalCode: "1108", marketingOptIn: "yes", terms: "on",
  })) form.set(key, value);
  return form;
}

let address = 0;

describe("customer auth form actions", () => {
  afterEach(() => vi.useRealTimers());

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T00:00:00Z"));
    requestHeaders.set("x-forwarded-for", `203.0.113.${++address}`);
    requestHeaders.delete("x-real-ip");
    signUpCustomer.mockReset();
    requestCustomerPasswordReset.mockReset();
    resendCustomerVerification.mockReset();
  });

  test("sign-up reports field errors without creating a login", async () => {
    const result = await submitSignUp(new FormData());
    expect(result.fieldErrors).toBeDefined();
    expect(signUpCustomer).not.toHaveBeenCalled();
  });

  test("password-reset request reaches the operation", async () => {
    requestCustomerPasswordReset.mockResolvedValue({ status: "requested" });
    const formData = new FormData();
    formData.set("email", "shopper@example.com");

    await expect(submitForgotPassword({}, formData)).resolves.toEqual({
      requestedEmail: "shopper@example.com",
    });
    expect(requestCustomerPasswordReset).toHaveBeenCalledTimes(1);
  });

  test("verification resend rejects an invalid email before sending", async () => {
    await expect(
      resendVerificationEmail({}, new FormData()),
    ).resolves.toEqual({ message: "Enter a valid email address." });
    expect(resendCustomerVerification).not.toHaveBeenCalled();
  });
  test.each([
    ["sign-up", async () => submitSignUp(validForm()), { email: "jane@example.com" }, "formError"],
    ["password reset", async () => submitForgotPassword({}, validForm()), { requestedEmail: "jane@example.com" }, "message"],
    ["verification resend", async () => resendVerificationEmail({}, validForm()), { message: "If that email needs verification, we sent a new link." }, "message"],
  ] as const)("%s refuses attempt six and permits attempts after ten minutes", async (_name, submit, success, errorKey) => {
    signUpCustomer.mockResolvedValue({ email: "jane@example.com" });
    requestCustomerPasswordReset.mockResolvedValue({ status: "requested" });
    resendCustomerVerification.mockResolvedValue("sent");
    for (let attempt = 0; attempt < 5; attempt++) {
      expect(await submit()).toEqual(success);
    }
    expect(await submit()).toHaveProperty(errorKey, "Too many attempts. Please try again in 10 minutes.");
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(await submit()).toEqual(success);
  });

  test("spoofed forwarded prefixes cannot bypass the address limit", async () => {
    const trusted = requestHeaders.get("x-forwarded-for");
    for (let attempt = 0; attempt < 6; attempt++) {
      requestHeaders.set("x-forwarded-for", `198.51.100.${attempt}, ${trusted}`);
      const result = await submitSignUp(new FormData());
      if (attempt < 5) expect(result.fieldErrors).toBeDefined();
      else expect(result.formError).toBe("Too many attempts. Please try again in 10 minutes.");
    }
  });

  test("addresses and actions have independent limits", async () => {
    for (let attempt = 0; attempt < 5; attempt++) await submitSignUp(new FormData());
    expect((await submitSignUp(new FormData())).formError).toBeDefined();
    expect(await resendVerificationEmail({}, new FormData())).toEqual({ message: "Enter a valid email address." });
    requestHeaders.set("x-forwarded-for", "192.0.2.123");
    expect((await submitSignUp(new FormData())).fieldErrors).toBeDefined();
  });

  test("missing or invalid forwarded addresses cannot rotate x-real-ip to bypass the limit", async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt % 2) requestHeaders.set("x-forwarded-for", "invalid");
      else requestHeaders.delete("x-forwarded-for");
      requestHeaders.set("x-real-ip", `198.51.100.${attempt}`);
      const result = await submitSignUp(new FormData());
      if (attempt < 5) expect(result.fieldErrors).toBeDefined();
      else expect(result.formError).toBe("Too many attempts. Please try again in 10 minutes.");
    }
  });

});

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const {
  requestHeaders,
  signUpCustomer,
  requestCustomerPasswordReset,
  resendCustomerVerification,
  idNumberInUse,
} = vi.hoisted(() => ({
  requestHeaders: new Headers(),
  signUpCustomer: vi.fn(),
  requestCustomerPasswordReset: vi.fn(),
  resendCustomerVerification: vi.fn(),
  idNumberInUse: vi.fn(async () => false),
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
vi.mock("@/lib/senior-pwd/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/senior-pwd/store")>()),
  idNumberInUse,
}));
vi.mock("@/lib/neon-auth/server", () => ({
  neonAuth: {},
  neonPasswordResetAuth: {},
  neonVerificationAuth: {},
}));

import { submitForgotPassword } from "@/app/(auth)/(signed-out)/forgot-password/actions";
import { submitSignUp } from "@/app/(auth)/(signed-out)/signup/actions";
import { resendVerificationEmail } from "@/app/(site)/verify-email/actions";

function tokenForm() {
  const form = new FormData();
  form.set("cf-turnstile-response", "XXXX.DUMMY.TOKEN.XXXX");
  return form;
}

function validForm() {
  const form = tokenForm();
  for (const [key, value] of Object.entries({
    firstName: "Jane", lastName: "Doe", email: "jane@example.com",
    password: "Password1!", confirmPassword: "Password1!",
    contactNumber: "09171234567", street: "123 Katipunan Avenue",
    barangay: "Loyola Heights", city: "Quezon City", province: "Metro Manila",
    postalCode: "1108", seniorPwd: "no", marketingOptIn: "yes", terms: "on",
  })) form.set(key, value);
  return form;
}

let address = 0;

describe("customer auth form actions", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  beforeEach(() => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => Response.json({ success: true })));
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T00:00:00Z"));
    requestHeaders.set("x-forwarded-for", `203.0.113.${++address}`);
    requestHeaders.delete("x-real-ip");
    signUpCustomer.mockReset();
    requestCustomerPasswordReset.mockReset();
    resendCustomerVerification.mockReset();
  });

  test.each([
    ["sign-up", (form: FormData) => submitSignUp(form), "formError"],
    ["password reset", (form: FormData) => submitForgotPassword({}, form), "message"],
    ["verification resend", (form: FormData) => resendVerificationEmail({}, form), "message"],
  ] as const)("%s refuses a missing token before any work", async (_name, submit, errorKey) => {
    await expect(submit(new FormData())).resolves.toEqual({
      [errorKey]: "Please complete the security check and try again.",
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(signUpCustomer).not.toHaveBeenCalled();
    expect(requestCustomerPasswordReset).not.toHaveBeenCalled();
    expect(resendCustomerVerification).not.toHaveBeenCalled();
  });

  test.each([
    ["sign-up", (form: FormData) => submitSignUp(form), "formError"],
    ["password reset", (form: FormData) => submitForgotPassword({}, form), "message"],
    ["verification resend", (form: FormData) => resendVerificationEmail({}, form), "message"],
  ] as const)("%s refuses invalid tokens and verification outages", async (_name, submit, errorKey) => {
    for (const failure of [
      () => Promise.resolve(Response.json({ success: false })),
      () => Promise.resolve(Response.json({ success: "true" })),
      () => Promise.resolve(new Response("bad gateway", { status: 502 })),
      () => Promise.resolve(new Response("invalid json")),
      () => Promise.reject(new Error("network unavailable")),
    ]) {
      vi.mocked(fetch).mockImplementationOnce(failure);
      await expect(submit(validForm())).resolves.toEqual({
        [errorKey]: "Please complete the security check and try again.",
      });
    }
    expect(signUpCustomer).not.toHaveBeenCalled();
    expect(requestCustomerPasswordReset).not.toHaveBeenCalled();
    expect(resendCustomerVerification).not.toHaveBeenCalled();
    const [, request] = vi.mocked(fetch).mock.calls[0];
    expect(String(request?.body)).toContain("secret=1x0000000000000000000000000000000AA");
    expect(String(request?.body)).toContain("response=XXXX.DUMMY.TOKEN.XXXX");
    expect(request?.cache).toBe("no-store");
  });

  test("sign-up reports field errors without creating a login", async () => {
    const result = await submitSignUp(tokenForm());
    expect(result.fieldErrors).toBeDefined();
    expect(signUpCustomer).not.toHaveBeenCalled();
  });

  test("sign-up refuses an ID already used by another account before any login is made", async () => {
    idNumberInUse.mockResolvedValueOnce(true);
    const form = validForm();
    form.set("seniorPwd", "yes");
    form.set("idType", "senior");
    form.set("idNumber", "ANT-SC-0458721");
    form.set("idExpiry", "2099-03-15");
    form.set("idFront", new File(["x"], "front.jpg", { type: "image/jpeg" }));
    await expect(submitSignUp(form)).resolves.toEqual({
      fieldErrors: { idNumber: ["This ID is already used by another account."] },
      toastError: "This ID is already used by another account.",
    });
    expect(signUpCustomer).not.toHaveBeenCalled();
  });

  test("password-reset request reaches the operation", async () => {
    requestCustomerPasswordReset.mockResolvedValue({ status: "requested" });
    const formData = tokenForm();
    formData.set("email", "shopper@example.com");

    await expect(submitForgotPassword({}, formData)).resolves.toEqual({
      requestedEmail: "shopper@example.com",
    });
    expect(requestCustomerPasswordReset).toHaveBeenCalledTimes(1);
  });

  test("verification resend rejects an invalid email before sending", async () => {
    await expect(
      resendVerificationEmail({}, tokenForm()),
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
      const result = await submitSignUp(tokenForm());
      if (attempt < 5) expect(result.fieldErrors).toBeDefined();
      else expect(result.formError).toBe("Too many attempts. Please try again in 10 minutes.");
    }
  });

  test("addresses and actions have independent limits", async () => {
    for (let attempt = 0; attempt < 5; attempt++) await submitSignUp(tokenForm());
    expect((await submitSignUp(tokenForm())).formError).toBeDefined();
    expect(await resendVerificationEmail({}, tokenForm())).toEqual({ message: "Enter a valid email address." });
    requestHeaders.set("x-forwarded-for", "192.0.2.123");
    expect((await submitSignUp(tokenForm())).fieldErrors).toBeDefined();
  });

  test("missing or invalid forwarded addresses cannot rotate x-real-ip to bypass the limit", async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      if (attempt % 2) requestHeaders.set("x-forwarded-for", "invalid");
      else requestHeaders.delete("x-forwarded-for");
      requestHeaders.set("x-real-ip", `198.51.100.${attempt}`);
      const result = await submitSignUp(tokenForm());
      if (attempt < 5) expect(result.fieldErrors).toBeDefined();
      else expect(result.formError).toBe("Too many attempts. Please try again in 10 minutes.");
    }
  });

});

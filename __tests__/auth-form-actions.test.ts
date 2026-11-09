import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  signUpCustomer,
  requestCustomerPasswordReset,
  resendCustomerVerification,
} = vi.hoisted(() => ({
  signUpCustomer: vi.fn(),
  requestCustomerPasswordReset: vi.fn(),
  resendCustomerVerification: vi.fn(),
}));

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

describe("customer auth form actions", () => {
  beforeEach(() => {
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
});

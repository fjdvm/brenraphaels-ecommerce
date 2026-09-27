import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  checkBotId,
  signUpCustomer,
  requestCustomerPasswordReset,
  resendCustomerVerification,
} = vi.hoisted(() => ({
  checkBotId: vi.fn(),
  signUpCustomer: vi.fn(),
  requestCustomerPasswordReset: vi.fn(),
  resendCustomerVerification: vi.fn(),
}));

vi.mock("botid/server", () => ({ checkBotId }));
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

describe("BotID-protected auth actions", () => {
  beforeEach(() => {
    checkBotId.mockResolvedValue({ isBot: true });
    signUpCustomer.mockReset();
    requestCustomerPasswordReset.mockReset();
    resendCustomerVerification.mockReset();
  });

  test("refuses an unchecked sign-up before creating a login", async () => {
    await expect(submitSignUp(new FormData())).resolves.toEqual({
      formError: "Please try again from your browser.",
    });
    expect(signUpCustomer).not.toHaveBeenCalled();
  });

  test("refuses an unchecked password-reset request before sending email", async () => {
    await expect(
      submitForgotPassword({}, new FormData()),
    ).resolves.toEqual({ message: "Please try again from your browser." });
    expect(requestCustomerPasswordReset).not.toHaveBeenCalled();
  });

  test("lets a request with a valid check through to the operation", async () => {
    checkBotId.mockResolvedValue({ isBot: false });
    requestCustomerPasswordReset.mockResolvedValue({ status: "requested" });
    const formData = new FormData();
    formData.set("email", "shopper@example.com");

    await expect(submitForgotPassword({}, formData)).resolves.toEqual({
      requestedEmail: "shopper@example.com",
    });
    expect(requestCustomerPasswordReset).toHaveBeenCalledTimes(1);
  });

  test("refuses an unchecked verification resend before sending email", async () => {
    await expect(
      resendVerificationEmail({}, new FormData()),
    ).resolves.toEqual({ message: "Please try again from your browser." });
    expect(resendCustomerVerification).not.toHaveBeenCalled();
  });
});

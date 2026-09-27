"use server";

import { requestCustomerPasswordReset } from "@/lib/customer/password-reset";
import { neonPasswordResetAuth } from "@/lib/neon-auth/server";
import { botIdFailureMessage, hasValidBotIdCheck } from "@/lib/security/botid";

export type ForgotPasswordFormState = {
  /** Set once a request was made; the same for every email. */
  requestedEmail?: string;
  message?: string;
};

export async function submitForgotPassword(
  _previousState: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  if (!(await hasValidBotIdCheck())) {
    return { message: botIdFailureMessage };
  }

  const email = formData.get("email");
  const result = await requestCustomerPasswordReset(
    typeof email === "string" ? email : "",
    { auth: neonPasswordResetAuth },
  );

  if (result.status === "invalid-email") {
    return { message: result.message };
  }
  return { requestedEmail: String(email).trim() };
}

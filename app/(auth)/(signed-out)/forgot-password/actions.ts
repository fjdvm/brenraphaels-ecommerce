"use server";

import { requestCustomerPasswordReset } from "@/lib/customer/password-reset";
import { neonPasswordResetAuth } from "@/lib/neon-auth/server";

export type ForgotPasswordFormState = {
  /** Set once a request was made; the same for every email. */
  requestedEmail?: string;
  message?: string;
};

export const initialForgotPasswordFormState: ForgotPasswordFormState = {};

export async function submitForgotPassword(
  _previousState: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
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

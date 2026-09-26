"use server";

import { resetCustomerPassword } from "@/lib/customer/password-reset";
import { neonPasswordResetAuth } from "@/lib/neon-auth/server";

export type ResetPasswordFormState = {
  status?: "reset" | "invalid-link";
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialResetPasswordFormState: ResetPasswordFormState = {};

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function submitResetPassword(
  _previousState: ResetPasswordFormState,
  formData: FormData,
): Promise<ResetPasswordFormState> {
  const result = await resetCustomerPassword(
    {
      token: text(formData.get("token")),
      password: text(formData.get("password")),
      confirmPassword: text(formData.get("confirmPassword")),
    },
    { auth: neonPasswordResetAuth },
  );

  if (result.status === "invalid-password") {
    return { fieldErrors: result.fieldErrors };
  }
  return { status: result.status };
}

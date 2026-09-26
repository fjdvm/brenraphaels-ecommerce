import { z } from "zod";

import {
  confirmPasswordField,
  emailField,
  passwordField,
  passwordsMatch,
} from "../validators/fields";

const tokenMaximumLength = 2_048;

export type PasswordResetAuth = {
  /** Neon answers the same way whether or not the email has a login. */
  requestPasswordReset(email: string): Promise<void>;
  /** "invalid" covers a link that expired or was already used. */
  resetPassword(details: {
    token: string;
    newPassword: string;
  }): Promise<"reset" | "invalid">;
};

export type PasswordResetRequestResult =
  | { status: "requested" }
  | { status: "invalid-email"; message: string };

export type PasswordResetResult =
  | { status: "reset" }
  | { status: "invalid-link" }
  | { status: "failed" }
  | {
      status: "invalid-password";
      fieldErrors: Record<string, string[] | undefined>;
    };

const newPasswordSchema = passwordsMatch(
  z.object({ password: passwordField, confirmPassword: confirmPasswordField }),
);

export async function requestCustomerPasswordReset(
  email: string,
  dependencies: { auth: PasswordResetAuth },
): Promise<PasswordResetRequestResult> {
  const parsed = emailField.safeParse(email);
  if (!parsed.success) {
    return { status: "invalid-email", message: parsed.error.issues[0].message };
  }

  try {
    await dependencies.auth.requestPasswordReset(parsed.data);
  } catch (error) {
    // A failure that only happens for real Customers (for example, the email
    // could not be sent) would reveal which emails belong to one, so the reply
    // stays the same and the failure is logged for us instead.
    console.error("Password reset request failed", error);
  }

  return { status: "requested" };
}

export async function resetCustomerPassword(
  input: { token?: string; password: string; confirmPassword: string },
  dependencies: { auth: PasswordResetAuth },
): Promise<PasswordResetResult> {
  const { token } = input;
  if (!token || token.length > tokenMaximumLength) {
    return { status: "invalid-link" };
  }

  // Checked first: Neon spends the link when it sets the password, so a weak
  // password must not use it up.
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "invalid-password",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  try {
    const outcome = await dependencies.auth.resetPassword({
      token,
      newPassword: parsed.data.password,
    });
    return outcome === "reset" ? { status: "reset" } : { status: "invalid-link" };
  } catch (error) {
    // Neon failed in a way that says nothing about the link (for example it is
    // down or rate-limiting), so the Customer is told to try again.
    console.error("Password reset failed", error);
    return { status: "failed" };
  }
}

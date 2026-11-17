"use server";

import { redirect } from "next/navigation";

import { safeReturnPath } from "@/lib/auth/route-access";
import { isDeletedCustomerEmail } from "@/lib/customer/delete-account";
import { signInCustomer } from "@/lib/customer/sign-in";
import { getDatabase } from "@/lib/db";
import { neonSignInAuth } from "@/lib/neon-auth/server";

export type SignInFormState = {
  message?: string;
  /** Set when the email must be verified before signing in. */
  unverifiedEmail?: string;
};

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

export async function submitSignIn(
  _previousState: SignInFormState,
  formData: FormData,
): Promise<SignInFormState> {
  const result = await signInCustomer(
    { email: text(formData.get("email")), password: text(formData.get("password")) },
    { auth: neonSignInAuth, isDeleted: (email) => isDeletedCustomerEmail(email, getDatabase()) },
  );

  if (result.status === "invalid") {
    return { message: result.message };
  }
  if (result.status === "unverified") {
    return { unverifiedEmail: result.email };
  }

  redirect(safeReturnPath(text(formData.get("next"))) ?? "/profile");
}

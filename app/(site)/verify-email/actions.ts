"use server";

import { scheduleStaffSignal } from "@/lib/notifications/staff-signal";

import {
  resendCustomerVerification,
  verifyCustomerEmail,
} from "@/lib/customer/email-verification";
import { createVerificationResendStore } from "@/lib/customer/verification-resend-store";
import { createVerificationTokenStore } from "@/lib/customer/verification-token-store";
import { getDatabase } from "@/lib/db";
import { emailField } from "@/lib/validators/fields";
import { neonVerificationAuth } from "@/lib/neon-auth/server";

export type ResendVerificationState = {
  message?: string;
};

export async function confirmVerificationEmail(token: string | undefined) {
  const result = await verifyCustomerEmail(token, {
    auth: neonVerificationAuth,
    now: new Date(),
    tokenStore: createVerificationTokenStore(getDatabase()),
  });
  if (result === "verified") scheduleStaffSignal("Customer");
  return result;
}

export async function resendVerificationEmail(
  _previousState: ResendVerificationState,
  formData: FormData,
): Promise<ResendVerificationState> {
  const email = emailField.safeParse(formData.get("email"));
  if (!email.success) {
    return { message: "Enter a valid email address." };
  }

  const result = await resendCustomerVerification(email.data, {
    auth: neonVerificationAuth,
    resendStore: createVerificationResendStore(getDatabase()),
    now: new Date(),
  });

  return result === "sent"
    ? { message: "If that email needs verification, we sent a new link." }
    : { message: "Please wait a minute before requesting another email." };
}

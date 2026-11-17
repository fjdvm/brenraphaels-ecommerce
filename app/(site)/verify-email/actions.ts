"use server";

import { verifyTurnstile, turnstileErrorMessage } from "@/lib/customer/turnstile";

import { allowAuthAttempt, authRateLimitMessage } from "@/lib/customer/auth-rate-limit";

import { scheduleStaffSignal } from "@/lib/notifications/staff-signal";

import {
  resendCustomerVerification,
  verifyCustomerEmail,
} from "@/lib/customer/email-verification";
import { createVerificationResendStore } from "@/lib/customer/verification-resend-store";
import { createVerificationTokenStore } from "@/lib/customer/verification-token-store";
import { getDatabase } from "@/lib/db";
import { emailField } from "@/lib/validators/fields";
import { neonVerificationAuth, getVisitorSession } from "@/lib/neon-auth/server";
import { restoreReturningCustomer } from "@/lib/customer/returning-customer";
import { createWelcomeEmailStore } from "@/lib/customer/sign-up";
import { sendWelcomeBackEmail } from "@/lib/email/welcome-back-email";
import { writeAuditEvent } from "@/lib/audit/gateway";

export type ResendVerificationState = {
  message?: string;
};

export async function confirmVerificationEmail(token: string | undefined) {
  const result = await verifyCustomerEmail(token, {
    auth: neonVerificationAuth,
    now: new Date(),
    tokenStore: createVerificationTokenStore(getDatabase()),
  });
  if (result === "verified") {
    scheduleStaffSignal("Customer");
    // A Deleted Customer who signed up again is restored only now, once the
    // email is verified. A failure here must not fail the verification.
    try {
      const visitor = await getVisitorSession();
      if (visitor) {
        await restoreReturningCustomer(visitor.email, visitor.userId, {
          db: getDatabase(),
          audit: (event) => writeAuditEvent(event),
          welcomeBack: { store: createWelcomeEmailStore(getDatabase()), send: sendWelcomeBackEmail },
        });
      }
    } catch (error) {
      console.error("Restoring a Returning Customer failed", error);
    }
  }
  return result;
}

export async function resendVerificationEmail(
  _previousState: ResendVerificationState,
  formData: FormData,
): Promise<ResendVerificationState> {
  if (!(await verifyTurnstile(formData))) {
    return { message: turnstileErrorMessage };
  }

  if (!(await allowAuthAttempt("resend-verification"))) {
    return { message: authRateLimitMessage };
  }

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

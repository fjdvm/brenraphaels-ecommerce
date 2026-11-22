"use server";

import { verifyTurnstile, turnstileErrorMessage } from "@/lib/customer/turnstile";

import { allowAuthAttempt, authRateLimitMessage } from "@/lib/customer/auth-rate-limit";

import { z } from "zod";
import { redirect } from "next/navigation";

import { locationErrors } from "@/lib/address/locations";
import {
  CustomerDetailsSaveError,
  SignUpAuthError,
  createCustomerStore,
  createWelcomeEmailStore,
  signUpCustomer,
} from "@/lib/customer/sign-up";
import { customerSignUpSchema, signUpFormValues } from "@/lib/customer/sign-up-schema";
import { sendWelcomeEmail } from "@/lib/email/welcome-email";
import { writeAuditEvent } from "@/lib/audit/gateway";
import {
  applicationProblem, idInUseMessage, parseSeniorPwdForm, submitSeniorPwdApplication, type SeniorPwdApplication,
} from "@/lib/senior-pwd/application";
import { idNumberInUse } from "@/lib/senior-pwd/store";
import { gatewayTicketFiles } from "@/lib/support/ticket-files";
import { getDatabase } from "@/lib/db";
import { removeNeonLogin } from "@/lib/neon-auth/management";
import { neonAuth } from "@/lib/neon-auth/server";

export type SignUpResult = {
  email?: string;
  /** Said after "Check your email" when the Customer's Senior/PWD ID could not be sent; they can send it again in Account settings. */
  notice?: string;
  /** A failure that belongs to no single field, such as Neon Auth being unavailable. */
  formError?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Shown as a toast as well as beside its field, such as an ID already used by another account. */
  toastError?: string;
};

export async function submitSignUp(formData: FormData): Promise<SignUpResult> {
  if (!(await verifyTurnstile(formData))) {
    return { formError: turnstileErrorMessage };
  }

  if (!(await allowAuthAttempt("sign-up"))) {
    return { formError: authRateLimitMessage };
  }

  const parsed = customerSignUpSchema.safeParse(signUpFormValues(formData));

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const badLocation = locationErrors(parsed.data);
  if (Object.keys(badLocation).length > 0) {
    return { fieldErrors: badLocation };
  }

  const seniorPwd = parseSeniorPwdForm(formData);
  if (!seniorPwd.ok) {
    return { fieldErrors: seniorPwd.fieldErrors };
  }

  // An ID already used by another account refuses the sign-up before the login is made. The lock in submitVerification
  // still catches two sign-ups racing for the same number; that rare loser gets the notice instead.
  if (seniorPwd.application && (await idNumberFree(seniorPwd.application.idNumber)) === false) {
    return { fieldErrors: { idNumber: [idInUseMessage] }, toastError: idInUseMessage };
  }

  try {
    const result = await signUpCustomer(parsed.data, {
      auth: neonAuth,
      audit: (event) => writeAuditEvent(event),
      customerStore: createCustomerStore(getDatabase()),
      removeLogin: (userId) => removeNeonLogin(userId),
      welcome: {
        store: createWelcomeEmailStore(getDatabase()),
        send: sendWelcomeEmail,
      },
    });
    return { email: result.email, notice: await sendSeniorPwdId(result.customerId, seniorPwd.application) };
  } catch (error) {
    if (error instanceof SignUpAuthError) {
      // The real cause (for example "Invalid origin") stays in the server log.
      console.error("Sign-up failed at Neon Auth", error);
      return {
        formError:
          "We couldn't create your login right now. Please try again in a moment.",
      };
    }
    if (error instanceof CustomerDetailsSaveError) {
      redirect("/complete-profile");
    }
    throw error;
  }
}

/** False when the number is pending or approved on another account; undefined when it could not be checked. */
async function idNumberFree(idNumber: string): Promise<boolean | undefined> {
  try {
    return !(await idNumberInUse(getDatabase(), idNumber));
  } catch (error) {
    console.error("A sign-up Senior/PWD ID number could not be checked", error instanceof Error ? error.message : "unknown");
    return undefined;
  }
}

/** Sends the ID a new Customer gave at sign-up for Staff review. It never fails the sign-up, which has already happened. */
async function sendSeniorPwdId(customerId: string | undefined, application: SeniorPwdApplication | undefined) {
  if (!customerId || !application) return undefined;
  try {
    const problem = applicationProblem(await submitSeniorPwdApplication(getDatabase(), customerId, application, gatewayTicketFiles()));
    return problem ? `${problem} You can send it again from Account settings once you're signed in.` : undefined;
  } catch (error) {
    console.error("A sign-up Senior/PWD ID could not be sent", error);
    return "We couldn't send your ID for review right now. You can send it again from Account settings once you're signed in.";
  }
}

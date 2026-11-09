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
  signUpCustomer,
} from "@/lib/customer/sign-up";
import { customerSignUpSchema, signUpFormValues } from "@/lib/customer/sign-up-schema";
import { getDatabase } from "@/lib/db";
import { neonAuth } from "@/lib/neon-auth/server";

export type SignUpResult = {
  email?: string;
  /** A failure that belongs to no single field, such as Neon Auth being unavailable. */
  formError?: string;
  fieldErrors?: Record<string, string[] | undefined>;
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

  try {
    const result = await signUpCustomer(parsed.data, {
      auth: neonAuth,
      customerStore: createCustomerStore(getDatabase()),
    });
    return { email: result.email };
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

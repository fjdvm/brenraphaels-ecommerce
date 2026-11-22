"use server";

import { redirect } from "next/navigation";

import { profilePath } from "@/lib/auth/route-access";
import { completeCustomerProfile } from "@/lib/customer/complete-profile";
import { completeProfileFormValues } from "@/lib/customer/complete-profile-schema";
import { requireVisitorNeedingDetails } from "@/lib/customer/current-visitor";
import { createCustomerStore } from "@/lib/customer/sign-up";
import { getDatabase } from "@/lib/db";
import { applicationProblem, idInUseMessage, parseSeniorPwdForm, submitSeniorPwdApplication } from "@/lib/senior-pwd/application";
import { idNumberInUse } from "@/lib/senior-pwd/store";
import { gatewayTicketFiles } from "@/lib/support/ticket-files";

export type CompleteProfileFormResult = {
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Shown as a toast, such as an ID already used by another account. */
  toastError?: string;
};

export async function submitCompleteProfile(
  formData: FormData,
): Promise<CompleteProfileFormResult> {
  // Server actions are public endpoints, so the page's guard is repeated here.
  const visitor = await requireVisitorNeedingDetails();

  const seniorPwd = parseSeniorPwdForm(formData);
  if (!seniorPwd.ok) {
    return { fieldErrors: seniorPwd.fieldErrors };
  }

  // An ID already used by another account is refused before anything is saved, so the Customer can fix it here.
  if (seniorPwd.application && (await inUse(seniorPwd.application.idNumber, visitor.userId))) {
    return { fieldErrors: { idNumber: [idInUseMessage] }, toastError: idInUseMessage };
  }

  let result;
  try {
    result = await completeCustomerProfile(completeProfileFormValues(formData), {
      identity: visitor,
      customerStore: createCustomerStore(getDatabase()),
    });
  } catch (error) {
    console.error("Completing a Customer profile failed", error);
    return { message: "We couldn't save your details. Please try again." };
  }

  if (result.status === "invalid") {
    return { fieldErrors: result.fieldErrors };
  }

  if (result.status === "email-taken") {
    return {
      message:
        "This email already belongs to another Customer, so we couldn't save your details. Please contact us for help.",
    };
  }

  // The details are saved, so a problem with the ID never blocks them: Account settings shows the ID's status and lets the
  // Customer send it again.
  if (result.status === "completed" && seniorPwd.application) {
    try {
      const outcome = await submitSeniorPwdApplication(getDatabase(), visitor.userId, seniorPwd.application, gatewayTicketFiles());
      // Only a race with another account (or file-storage down) gets here; Account settings shows the ID's status.
      if (applicationProblem(outcome)) console.warn("A complete-profile Senior/PWD ID was not sent", outcome.status);
    } catch (error) {
      console.error("A Senior/PWD ID could not be sent", error);
    }
  }

  redirect(profilePath);
}

/** A failed check never blocks the details: the ID is checked again, under a lock, when it is sent. */
async function inUse(idNumber: string, customerId: string): Promise<boolean> {
  try {
    return await idNumberInUse(getDatabase(), idNumber, customerId);
  } catch (error) {
    console.error("A complete-profile Senior/PWD ID number could not be checked", error instanceof Error ? error.message : "unknown");
    return false;
  }
}

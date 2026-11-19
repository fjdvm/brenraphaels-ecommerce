"use server";

import { redirect } from "next/navigation";

import { profilePath } from "@/lib/auth/route-access";
import { completeCustomerProfile } from "@/lib/customer/complete-profile";
import { completeProfileFormValues } from "@/lib/customer/complete-profile-schema";
import { requireVisitorNeedingDetails } from "@/lib/customer/current-visitor";
import { createCustomerStore } from "@/lib/customer/sign-up";
import { getDatabase } from "@/lib/db";
import { applicationProblem, parseSeniorPwdForm, submitSeniorPwdApplication } from "@/lib/senior-pwd/application";
import { gatewayTicketFiles } from "@/lib/support/ticket-files";

export type CompleteProfileFormResult = {
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
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
      if (applicationProblem(outcome)) console.warn("A complete-profile Senior/PWD ID was not sent", outcome.status);
    } catch (error) {
      console.error("A Senior/PWD ID could not be sent", error);
    }
  }

  redirect(profilePath);
}

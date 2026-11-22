"use server";

import { revalidatePath } from "next/cache";

import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { applicationProblem, idInUseMessage, parseSeniorPwdForm, submitSeniorPwdApplication } from "@/lib/senior-pwd/application";
import { idNumberInUse } from "@/lib/senior-pwd/store";
import { gatewayTicketFiles } from "@/lib/support/ticket-files";

export type SeniorPwdIdState = {
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
  /** Shown as a toast, such as an ID already used by another account. */
  toastError?: string;
  /** Changes on every answer, so the same toast shows again on a second try. */
  attempt?: number;
  sent?: boolean;
};

/** Sends the signed-in Customer's Senior Citizen / PWD ID for Staff review, for a Customer who did not give one at sign-up. */
export async function sendSeniorPwdId(_previous: SeniorPwdIdState, formData: FormData): Promise<SeniorPwdIdState> {
  // Server actions are public endpoints, so the page's guard is repeated here.
  const customer = await requireCustomer();
  const parsed = parseSeniorPwdForm(formData, { required: false });
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
  if (!parsed.application) return { message: "Add your ID details to send them." };

  // Refused before the photos are uploaded; submitVerification checks again under a lock.
  if (await idNumberInUse(getDatabase(), parsed.application.idNumber, customer.userId).catch(() => false)) {
    return { fieldErrors: { idNumber: [idInUseMessage] }, toastError: idInUseMessage, attempt: Date.now() };
  }

  const outcome = await submitSeniorPwdApplication(getDatabase(), customer.userId, parsed.application, gatewayTicketFiles());
  const problem = applicationProblem(outcome);
  if (outcome.status === "id-in-use") return { fieldErrors: { idNumber: [problem!] }, toastError: problem, attempt: Date.now() };
  if (problem) return { message: problem };
  revalidatePath("/profile/settings");
  return { sent: true };
}

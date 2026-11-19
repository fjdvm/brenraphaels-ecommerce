"use server";

import { revalidatePath } from "next/cache";

import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { applicationProblem, parseSeniorPwdForm, submitSeniorPwdApplication } from "@/lib/senior-pwd/application";
import { gatewayTicketFiles } from "@/lib/support/ticket-files";

export type SeniorPwdIdState = {
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
  sent?: boolean;
};

/** Sends the signed-in Customer's Senior Citizen / PWD ID for Staff review, for a Customer who did not give one at sign-up. */
export async function sendSeniorPwdId(_previous: SeniorPwdIdState, formData: FormData): Promise<SeniorPwdIdState> {
  // Server actions are public endpoints, so the page's guard is repeated here.
  const customer = await requireCustomer();
  const parsed = parseSeniorPwdForm(formData, { required: false });
  if (!parsed.ok) return { fieldErrors: parsed.fieldErrors };
  if (!parsed.application) return { message: "Add your ID details to send them." };

  const outcome = await submitSeniorPwdApplication(getDatabase(), customer.userId, parsed.application, gatewayTicketFiles());
  const problem = applicationProblem(outcome);
  if (problem) return { message: problem };
  revalidatePath("/profile/settings");
  return { sent: true };
}

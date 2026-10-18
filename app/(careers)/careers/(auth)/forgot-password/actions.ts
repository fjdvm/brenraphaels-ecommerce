"use server";
import { careersApplicantAuth } from "@/lib/careers/auth";
import { requestApplicantPasswordReset } from "@/lib/careers/identity";
export type ApplicantForgotPasswordState = { message?: string; fieldErrors?: Record<string, string[] | undefined>; values?: { email: string } };

export async function submitApplicantForgotPassword(
  _previous: ApplicantForgotPasswordState,
  formData: FormData,
): Promise<ApplicantForgotPasswordState> {
  const email = String(formData.get("email") ?? "");
  const result = await requestApplicantPasswordReset(
    email,
    { auth: careersApplicantAuth },
  );
  if (result.status === "invalid-email") return { message: result.message, fieldErrors: result.fieldErrors, values: { email } };
  return { message: "If that email belongs to an Applicant, we sent a reset link." };
}

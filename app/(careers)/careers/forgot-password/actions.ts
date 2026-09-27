"use server";
import { careersApplicantAuth } from "@/lib/careers/auth";
import { requestApplicantPasswordReset } from "@/lib/careers/identity";
export type ApplicantForgotPasswordState = { message?: string };

export async function submitApplicantForgotPassword(
  _previous: ApplicantForgotPasswordState,
  formData: FormData,
): Promise<ApplicantForgotPasswordState> {
  const result = await requestApplicantPasswordReset(
    String(formData.get("email") ?? ""),
    { auth: careersApplicantAuth },
  );
  return {
    message:
      result.status === "requested"
        ? "If that email belongs to an Applicant, we sent a reset link."
        : result.message,
  };
}

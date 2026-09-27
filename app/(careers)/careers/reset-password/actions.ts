"use server";
import { redirect } from "next/navigation";
import { careersApplicantAuth } from "@/lib/careers/auth";
import { resetApplicantPassword } from "@/lib/careers/identity";
export type ApplicantResetPasswordState = { message?: string };

export async function submitApplicantResetPassword(
  _previous: ApplicantResetPasswordState,
  formData: FormData,
): Promise<ApplicantResetPasswordState> {
  const result = await resetApplicantPassword(
    {
      token: String(formData.get("token") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    },
    { auth: careersApplicantAuth },
  );
  if (result.status === "reset") redirect("/careers/signin");
  return {
    message:
      result.status === "invalid-password"
        ? "Check your new password and confirmation."
        : "This reset link is invalid or has expired.",
  };
}

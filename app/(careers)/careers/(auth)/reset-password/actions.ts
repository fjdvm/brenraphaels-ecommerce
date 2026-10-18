"use server";
import { redirect } from "next/navigation";
import { careersApplicantAuth } from "@/lib/careers/auth";
import { resetApplicantPassword } from "@/lib/careers/identity";
export type ApplicantResetPasswordState = { message?: string; fieldErrors?: Record<string, string[] | undefined> };

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
  if (result.status === "invalid-password") return { message: "Check the highlighted fields.", fieldErrors: result.fieldErrors };
  if (result.status === "failed") return { message: "We couldn't reset your password. Please try again." };
  return { message: "This reset link is invalid or has expired." };
}

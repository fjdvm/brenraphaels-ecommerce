"use server";
import { redirect } from "next/navigation";
import { careersApplicantAuth } from "@/lib/careers/auth";
import { signInApplicant } from "@/lib/careers/identity";
export type ApplicantSignInState = { message?: string };

export async function submitApplicantSignIn(
  _previous: ApplicantSignInState,
  formData: FormData,
): Promise<ApplicantSignInState> {
  const result = await signInApplicant({ email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") }, { auth: careersApplicantAuth });
  if (result.status === "signed-in") redirect("/careers/profile");
  return { message: result.status === "unverified" ? "Verify your email before signing in." : result.message };
}

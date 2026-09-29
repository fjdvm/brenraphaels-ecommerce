"use server";
import { redirect } from "next/navigation";
import { careersApplicantAuth } from "@/lib/careers/auth";
import { signInApplicant } from "@/lib/careers/identity";
export type ApplicantSignInState = { message?: string; fieldErrors?: Record<string, string[] | undefined>; values?: { email: string } };

export async function submitApplicantSignIn(
  _previous: ApplicantSignInState,
  formData: FormData,
): Promise<ApplicantSignInState> {
  const email = String(formData.get("email") ?? "");
  const result = await signInApplicant({ email, password: String(formData.get("password") ?? "") }, { auth: careersApplicantAuth });
  if (result.status === "signed-in") redirect("/careers/profile");
  if (result.status === "unverified") return { message: "Verify your email before signing in.", values: { email } };
  return { message: result.message, fieldErrors: "fieldErrors" in result ? result.fieldErrors : undefined, values: { email } };
}

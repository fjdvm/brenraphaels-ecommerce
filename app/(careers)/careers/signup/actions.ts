"use server";
import { careersApplicantAuth } from "@/lib/careers/auth";
import { signUpApplicant } from "@/lib/careers/identity";

export type ApplicantSignUpState = { message?: string };

export async function submitApplicantSignUp(
  _previous: ApplicantSignUpState,
  formData: FormData,
): Promise<ApplicantSignUpState> {
  try {
    const result = await signUpApplicant({ name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") }, { auth: careersApplicantAuth });
    return { message: `We sent a verification link to ${result.email}.` };
  } catch (error) {
    console.error("Applicant sign-up failed", error);
    return { message: "We couldn't create your Applicant account. Please try again." };
  }
}

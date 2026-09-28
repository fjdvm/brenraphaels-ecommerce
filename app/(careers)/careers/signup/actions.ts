"use server";
import { careersApplicantAuth } from "@/lib/careers/auth";
import { signUpApplicant } from "@/lib/careers/identity";

export type ApplicantSignUpState = {
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function submitApplicantSignUp(
  _previous: ApplicantSignUpState,
  formData: FormData,
): Promise<ApplicantSignUpState> {
  try {
    const result = await signUpApplicant(
      {
        firstName: String(formData.get("firstName") ?? ""),
        middleName: String(formData.get("middleName") ?? ""),
        lastName: String(formData.get("lastName") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        confirmPassword: String(formData.get("confirmPassword") ?? ""),
      },
      { auth: careersApplicantAuth },
    );
    if (result.status === "invalid-input") {
      return { message: "Check the highlighted fields.", fieldErrors: result.fieldErrors };
    }
    return { message: `We sent a verification link to ${result.email}.` };
  } catch (error) {
    console.error("Applicant sign-up failed", error);
    return { message: "We couldn't create your Applicant account. Please try again." };
  }
}

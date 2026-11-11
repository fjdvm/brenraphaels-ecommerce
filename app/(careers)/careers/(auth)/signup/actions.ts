"use server";
import { careersApplicantAuth } from "@/lib/careers/auth";
import { signUpApplicant } from "@/lib/careers/identity";

export type ApplicantSignUpState = {
  /** How the last attempt ended; drives the shared loading card. */
  status?: "sent" | "invalid" | "failed";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** What was typed (never the passwords), so a rejected form keeps it. */
  values?: Record<string, string>;
};

/**
 * The design words two messages differently from the shared validators. Only the wording is swapped here, in the
 * Careers sign-up; what is accepted stays decided by the validators (lib/validators/fields.ts).
 */
const designCopy: Record<string, Record<string, string>> = {
  email: { "Enter a valid email address": "Enter a full email address, like name@gmail.com" },
  confirmPassword: { "Passwords do not match": "Passwords don’t match" },
};

function withDesignCopy(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, messages]) => [field, messages?.map((message) => designCopy[field]?.[message] ?? message)]),
  );
}

export async function submitApplicantSignUp(
  _previous: ApplicantSignUpState,
  formData: FormData,
): Promise<ApplicantSignUpState> {
  const values = {
    firstName: String(formData.get("firstName") ?? ""),
    middleName: String(formData.get("middleName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
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
      return { status: "invalid", message: "Check the highlighted fields.", fieldErrors: withDesignCopy(result.fieldErrors), values };
    }
    return { status: "sent", message: `We sent a verification link to ${result.email}.` };
  } catch (error) {
    console.error("Applicant sign-up failed", error);
    return { status: "failed", message: "We couldn't create your Applicant account. Please try again.", values };
  }
}

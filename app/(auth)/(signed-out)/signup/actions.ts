"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import {
  CustomerDetailsSaveError,
  createCustomerStore,
  customerSignUpSchema,
  signUpCustomer,
} from "@/lib/customer/sign-up";
import { getDatabase } from "@/lib/db";
import { neonAuth } from "@/lib/neon-auth/server";

export type SignUpFormState = {
  email?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialSignUpFormState: SignUpFormState = {};

function signUpInput(formData: FormData) {
  return {
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    contactNumber: formData.get("contactNumber"),
    street: formData.get("street"),
    barangay: formData.get("barangay"),
    city: formData.get("city"),
    province: formData.get("province"),
    postalCode: formData.get("postalCode"),
    marketingOptIn: formData.get("marketingOptIn"),
    terms: formData.get("terms") === "on",
  };
}

export async function submitSignUp(
  _previousState: SignUpFormState,
  formData: FormData,
): Promise<SignUpFormState> {
  const input = signUpInput(formData);
  const parsed = customerSignUpSchema.safeParse(input);

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  try {
    const result = await signUpCustomer(parsed.data, {
      auth: neonAuth,
      customerStore: createCustomerStore(getDatabase()),
    });
    return { email: result.email };
  } catch (error) {
    if (error instanceof CustomerDetailsSaveError) {
      redirect("/complete-profile");
    }
    throw error;
  }
}

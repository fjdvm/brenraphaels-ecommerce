"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import {
  CustomerDetailsSaveError,
  createCustomerStore,
  signUpCustomer,
} from "@/lib/customer/sign-up";
import { customerSignUpSchema, signUpFormValues } from "@/lib/customer/sign-up-schema";
import { getDatabase } from "@/lib/db";
import { neonAuth } from "@/lib/neon-auth/server";

export type SignUpResult = {
  email?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function submitSignUp(formData: FormData): Promise<SignUpResult> {
  const parsed = customerSignUpSchema.safeParse(signUpFormValues(formData));

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

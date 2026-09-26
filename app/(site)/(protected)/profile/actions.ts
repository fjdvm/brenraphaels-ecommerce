"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createContactNumberStore,
  customerContactNumberSchema,
  updateCustomerContactNumber,
} from "@/lib/customer/contact-number";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";

export type ProfileContactNumberState = {
  fieldErrors?: Record<string, string[] | undefined>;
  saved?: boolean;
};

export const initialProfileContactNumberState: ProfileContactNumberState = {};

export async function saveContactNumber(
  _previousState: ProfileContactNumberState,
  formData: FormData,
): Promise<ProfileContactNumberState> {
  const parsed = customerContactNumberSchema.safeParse({
    contactNumber: formData.get("contactNumber"),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const customer = await requireCustomer();
  await updateCustomerContactNumber(parsed.data, {
    userId: customer.userId,
    contactNumberStore: createContactNumberStore(getDatabase()),
  });
  revalidatePath("/profile");

  return { saved: true };
}

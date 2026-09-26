"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createContactNumberStore,
  customerContactNumberSchema,
  updateCustomerContactNumber,
} from "@/lib/customer/contact-number";
import {
  addCustomerAddress,
  createAddressStore,
  CustomerAddressNotFoundError,
  customerAddressSchema,
  deleteCustomerAddress,
  LastCustomerAddressError,
  setCustomerDefaultAddress,
  updateCustomerAddress,
} from "@/lib/customer/addresses";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";

export type ProfileContactNumberState = {
  fieldErrors?: Record<string, string[] | undefined>;
  saved?: boolean;
};

export type ProfileAddressState = {
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
  failed?: boolean;
};

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

function addressFormValues(formData: FormData) {
  return {
    label: formData.get("label"),
    street: formData.get("street"),
    barangay: formData.get("barangay"),
    city: formData.get("city"),
    province: formData.get("province"),
    postalCode: formData.get("postalCode"),
  };
}

function addressId(formData: FormData) {
  return z.coerce.number().int().positive().safeParse(formData.get("addressId"));
}

export async function addAddress(
  _previousState: ProfileAddressState,
  formData: FormData,
): Promise<ProfileAddressState> {
  const parsed = customerAddressSchema.safeParse(addressFormValues(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const customer = await requireCustomer();
  await addCustomerAddress(parsed.data, {
    userId: customer.userId,
    addressStore: createAddressStore(getDatabase()),
  });
  revalidatePath("/profile");
  return { message: "Address added." };
}

export async function updateAddress(
  _previousState: ProfileAddressState,
  formData: FormData,
): Promise<ProfileAddressState> {
  const parsed = customerAddressSchema.safeParse(addressFormValues(formData));
  const parsedId = addressId(formData);
  if (!parsedId.success) {
    return { message: "Address not found.", failed: true };
  }
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const customer = await requireCustomer();
  try {
    await updateCustomerAddress(parsedId.data, parsed.data, {
      userId: customer.userId,
      addressStore: createAddressStore(getDatabase()),
    });
  } catch (error) {
    if (error instanceof CustomerAddressNotFoundError) {
      return { message: "Address not found.", failed: true };
    }
    throw error;
  }
  revalidatePath("/profile");
  return { message: "Address updated." };
}

export async function makeDefaultAddress(
  _previousState: ProfileAddressState,
  formData: FormData,
): Promise<ProfileAddressState> {
  const parsedId = addressId(formData);
  if (!parsedId.success) {
    return { message: "Address not found.", failed: true };
  }

  const customer = await requireCustomer();
  try {
    await setCustomerDefaultAddress(parsedId.data, {
      userId: customer.userId,
      addressStore: createAddressStore(getDatabase()),
    });
  } catch (error) {
    if (error instanceof CustomerAddressNotFoundError) {
      return { message: "Address not found.", failed: true };
    }
    throw error;
  }
  revalidatePath("/profile");
  return { message: "Default address changed." };
}

export async function removeAddress(
  _previousState: ProfileAddressState,
  formData: FormData,
): Promise<ProfileAddressState> {
  const parsedId = addressId(formData);
  if (!parsedId.success) {
    return { message: "Address not found.", failed: true };
  }

  const customer = await requireCustomer();
  try {
    await deleteCustomerAddress(parsedId.data, {
      userId: customer.userId,
      addressStore: createAddressStore(getDatabase()),
    });
  } catch (error) {
    if (error instanceof LastCustomerAddressError) {
      return { message: "You must keep at least one Address.", failed: true };
    }
    if (error instanceof CustomerAddressNotFoundError) {
      return { message: "Address not found.", failed: true };
    }
    throw error;
  }
  revalidatePath("/profile");
  return { message: "Address deleted." };
}

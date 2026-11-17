"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { idNumberField, idTypes, validateIdPhoto } from "@/lib/senior-pwd/id-number";
import { gatewayTicketFiles } from "@/lib/support/ticket-files";
import { fileIdField } from "@/lib/validators/file-id";
import { cleanFileName } from "@/lib/validators/sanitize";
import { addPickedAddress, createAddressStore, customerAddressSchema } from "@/lib/customer/addresses";
import { DEFAULT_COUNTRY, resolveAddress } from "@/lib/psgc";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { sendOrderPlacedEmail } from "@/lib/email/order-placed-email";
import { scheduleOrdersChanged } from "@/lib/orders/staff-signal";
import { sendOrderPlacedSignal } from "@/lib/notifications/gateway";
import {
  fulfillmentMethods,
  paymentMethods,
  createOrderStore,
  placeOrderAndNotify,
} from "@/lib/orders/orders";

const checkoutInput = z.object({
  fulfillmentMethod: z.enum(fulfillmentMethods),
  paymentMethod: z.enum(paymentMethods),
  addressId: z.number().int().positive().optional(),
  seniorPwd: z.object({
    lineId: z.number().int().positive(),
    idType: z.enum(idTypes).optional(),
    idNumber: idNumberField.optional(),
    photoFileId: fileIdField.optional(),
    photoBackFileId: fileIdField.optional(),
  }).optional(),
});

export type SeniorPwdUploadState = { fileId?: string; message?: string };

/** Stores one photo of the ID as a Private, Temporary File: file-storage removes it after 7 days if nobody reviews it. */
export async function uploadSeniorPwdPhoto(formData: FormData): Promise<SeniorPwdUploadState> {
  await requireCustomer();
  const photo = formData.get("photo");
  if (!(photo instanceof File)) return { message: "Choose a photo of your ID to upload." };
  try {
    validateIdPhoto(photo);
  } catch (error) {
    return { message: error instanceof Error ? error.message : "We couldn't use that photo." };
  }
  try {
    const fileId = await gatewayTicketFiles().upload({
      filename: cleanFileName(photo.name), contentType: photo.type, bytes: new Uint8Array(await photo.arrayBuffer()), retentionType: "temporary",
    });
    return { fileId };
  } catch (error) {
    console.error("An ID photo could not be stored in file-storage", error);
    return { message: "We couldn't upload that photo. Please try again." };
  }
}

export type CheckoutAddressState = {
  fieldErrors?: Record<string, string[] | undefined>;
  addressId?: number;
};

const pickedFields = customerAddressSchema.pick({ label: true, street: true, postalCode: true });

/** Adds an Address without making the Customer leave checkout. Country, Region, Province, City and Barangay arrive as PSGC codes. */
export async function addCheckoutAddress(
  _previousState: CheckoutAddressState,
  formData: FormData,
): Promise<CheckoutAddressState> {
  const parsed = pickedFields.safeParse({
    label: formData.get("label"),
    street: formData.get("street"),
    postalCode: formData.get("postalCode"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  if (formData.get("country") !== DEFAULT_COUNTRY) {
    return { fieldErrors: { address: ["We deliver within the Philippines only."] } };
  }
  const resolved = await resolveAddress({
    regionCode: String(formData.get("regionCode") ?? ""),
    provinceCode: String(formData.get("provinceCode") ?? ""),
    cityCode: String(formData.get("cityCode") ?? ""),
    barangayCode: String(formData.get("barangayCode") ?? ""),
  });
  if (!resolved.ok) {
    return { fieldErrors: { address: [resolved.message] } };
  }

  const customer = await requireCustomer();
  const addressId = await addPickedAddress({ ...parsed.data, ...resolved.address }, {
    userId: customer.userId,
    addressStore: createAddressStore(getDatabase()),
  });
  revalidatePath("/checkout");
  return { addressId };
}

export async function placeOrder(input: unknown) {
  const customer = await requireCustomer();
  const parsed = checkoutInput.parse(input);
  if (parsed.fulfillmentMethod === "delivery" && !parsed.addressId) {
    throw new Error("Choose an Address for Delivery.");
  }
  const order = await placeOrderAndNotify(customer.userId, customer.email, parsed, {
    orderStore: createOrderStore(getDatabase()),
    mailer: { send: sendOrderPlacedEmail },
  });
  scheduleOrdersChanged();
  // The Order is committed. A slow or failed signal must never delay checkout.
  after(async () => {
    try {
      await sendOrderPlacedSignal();
    } catch (error) {
      console.error("Order-placed signal could not be sent", error);
    }
  });
  revalidatePath("/cart");
  revalidatePath("/profile/orders");
  return { orderId: order.id };
}

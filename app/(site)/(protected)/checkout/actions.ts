"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { addPickedAddress, createAddressStore, customerAddressSchema } from "@/lib/customer/addresses";
import { DEFAULT_COUNTRY, resolveAddress } from "@/lib/psgc";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { sendOrderPlacedEmail } from "@/lib/email/order-placed-email";
import { scheduleOrdersChanged } from "@/lib/orders/staff-signal";
import { sendOrderPlacedSignal } from "@/lib/notifications/gateway";
import { fetchPaymentAvailability } from "@/lib/orders/payment-availability";
import { PAYMENT_LABELS } from "@/lib/orders/payment-details";
import { isPrepaid } from "@/lib/orders/payment-methods";
import {
  paymentMethods,
  createOrderStore,
  placeOrderAndNotify,
} from "@/lib/orders/orders";

const checkoutInput = z.object({
  fulfillmentMethod: z.literal("delivery"),
  paymentMethod: z.enum(paymentMethods),
  addressId: z.number().int().positive().optional(),
});

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
  // The shop delivers only: a stale page or a hand-made request asking for Pickup is refused with a plain reason.
  if (typeof input === "object" && input !== null && (input as { fulfillmentMethod?: unknown }).fulfillmentMethod === "pickup") {
    throw new Error("Pickup is no longer offered. Choose Delivery.");
  }
  const parsed = checkoutInput.parse(input);
  if (!parsed.addressId) {
    throw new Error("Choose an Address for Delivery.");
  }
  // The page can be stale: the shop may have switched this method off since checkout opened.
  if (isPrepaid(parsed.paymentMethod) && !(await fetchPaymentAvailability())[parsed.paymentMethod]) {
    throw new Error(`${PAYMENT_LABELS[parsed.paymentMethod]} can't be used right now. Choose another payment method, or try again shortly.`);
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

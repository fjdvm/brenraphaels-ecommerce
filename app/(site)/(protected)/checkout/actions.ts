"use server";

import { writeAuditEvent } from "@/lib/audit/gateway";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { locationErrors } from "@/lib/address/locations";
import { addCustomerAddress, createAddressStore, customerAddressSchema } from "@/lib/customer/addresses";
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
});

export type CheckoutAddressState = {
  fieldErrors?: Record<string, string[] | undefined>;
  addressId?: number;
};

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

/** Adds an Address without making the Customer leave checkout. */
export async function addCheckoutAddress(
  _previousState: CheckoutAddressState,
  formData: FormData,
): Promise<CheckoutAddressState> {
  const parsed = customerAddressSchema.safeParse(addressFormValues(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const badLocation = locationErrors(parsed.data);
  if (Object.keys(badLocation).length > 0) {
    return { fieldErrors: badLocation };
  }

  const customer = await requireCustomer();
  const addressId = await addCustomerAddress(parsed.data, {
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
    audit: writeAuditEvent,
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

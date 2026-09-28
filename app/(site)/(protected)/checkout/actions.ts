"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { sendOrderPlacedEmail } from "@/lib/email/order-placed-email";
import {
  fulfillmentMethods,
  paymentMethods,
  createOrderStore,
} from "@/lib/orders/orders";

const checkoutInput = z.object({
  fulfillmentMethod: z.enum(fulfillmentMethods),
  paymentMethod: z.enum(paymentMethods),
});

export async function placeOrder(input: unknown) {
  const customer = await requireCustomer();
  const parsed = checkoutInput.parse(input);
  const order = await createOrderStore(getDatabase()).place(customer.userId, parsed);
  await sendOrderPlacedEmail(customer.email, order);
  revalidatePath("/cart");
  revalidatePath("/profile/orders");
  return { orderId: order.id };
}

"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import {
  OrderFeedbackAlreadySubmittedError,
  OrderFeedbackNotAvailableError,
  createOrderFeedbackStore,
} from "@/lib/orders/feedback";
import { orderFeedbackInput } from "@/lib/orders/feedback-input";
import { createOrderStore } from "@/lib/orders/orders";
import { gcashReferenceNumberField, uploadPaymentProofScreenshot } from "@/lib/orders/payment-proof";

export type PaymentProofState = {
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export type OrderFeedbackState = {
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
  submitted?: boolean;
};

const paymentProofInput = z.object({ gcashReferenceNumber: gcashReferenceNumberField });

/** Bound to an Order id (`submitPaymentProof.bind(null, order.id)`) before use as a Form Action. */
export async function submitPaymentProof(
  orderId: number,
  _previousState: PaymentProofState,
  formData: FormData,
): Promise<PaymentProofState> {
  const customer = await requireCustomer();
  const parsed = paymentProofInput.safeParse({
    gcashReferenceNumber: formData.get("gcashReferenceNumber"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  let screenshotPathname: string | undefined;
  const screenshot = formData.get("screenshot");
  if (screenshot instanceof File && screenshot.size > 0) {
    const token = process.env.ORDERS_BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return {
        message: "Screenshot uploads aren't available right now. Submit your reference number without one, or try again later.",
      };
    }
    try {
      screenshotPathname = await uploadPaymentProofScreenshot(screenshot, {
        orderId,
        put: (pathname, body, options) => put(pathname, body, { ...options, token }),
      });
    } catch (error) {
      return { message: error instanceof Error ? error.message : "We couldn't upload that screenshot." };
    }
  }

  try {
    await createOrderStore(getDatabase()).submitPaymentProof(customer.userId, orderId, {
      gcashReferenceNumber: parsed.data.gcashReferenceNumber,
      screenshotPathname,
    });
  } catch (error) {
    return { message: error instanceof Error ? error.message : "We couldn't submit your payment proof." };
  }

  revalidatePath("/profile/orders");
  return { message: "Payment proof submitted. We'll email you once it's verified." };
}

/** Accepts one Customer-owned feedback response for a delivered Order. */
export async function submitOrderFeedback(
  _previousState: OrderFeedbackState,
  formData: FormData,
): Promise<OrderFeedbackState> {
  const parsed = orderFeedbackInput.safeParse({
    orderId: formData.get("orderId"),
    rating: formData.get("rating"),
    comment: formData.get("comment"),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  const customer = await requireCustomer();
  try {
    await createOrderFeedbackStore(getDatabase()).submit(customer.userId, parsed.data);
  } catch (error) {
    if (error instanceof OrderFeedbackNotAvailableError || error instanceof OrderFeedbackAlreadySubmittedError) {
      return { message: error.message };
    }
    console.error("Saving Order Feedback failed", error);
    return { message: "We couldn't save your Feedback. Please try again." };
  }

  revalidatePath("/profile/orders");
  return { submitted: true };
}

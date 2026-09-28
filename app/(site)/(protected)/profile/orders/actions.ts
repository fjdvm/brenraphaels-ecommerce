"use server";

import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createOrderStore } from "@/lib/orders/orders";
import { gcashReferenceNumberField, uploadPaymentProofScreenshot } from "@/lib/orders/payment-proof";

export type PaymentProofState = {
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
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

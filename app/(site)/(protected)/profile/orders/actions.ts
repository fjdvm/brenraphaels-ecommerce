"use server";

import { confirmedProofFields, confirmedAmountField, confirmedPaidAtField } from "@/lib/orders/payment-proof";

import { scheduleOrdersChanged } from "@/lib/orders/staff-signal";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { sendOrderCancelledEmail } from "@/lib/email/order-cancelled-email";
import {
  OrderFeedbackAlreadySubmittedError,
  OrderFeedbackNotAvailableError,
  createOrderFeedbackStore,
} from "@/lib/orders/feedback";
import { scheduleStaffSignal } from "@/lib/notifications/staff-signal";
import { queueFeedbackThankYou } from "@/lib/notifications/gateway";
import { orderFeedbackInput } from "@/lib/orders/feedback-input";
import { createOrderReceiptStore, OrderReceiptConflictError, OrderReceiptNotFoundError } from "@/lib/orders/receipt";
import { createOrderStore, OrderTransitionError, type Order } from "@/lib/orders/orders";
import { referenceNumberField, uploadPaymentProofScreenshot, validatePaymentProofScreenshot } from "@/lib/orders/payment-proof";
import { loadPaymentAccountSnapshot } from "@/lib/orders/payment-accounts";
import { liveOrdersUrl } from "@/lib/orders/live";
import { gatewayTicketFiles } from "@/lib/support/ticket-files";
import { positiveIntegerField } from "@/lib/validators/fields";

export type PaymentProofState = {
  message?: string;
  submitted?: boolean;
  fieldErrors?: Record<string, string[] | undefined>;
};

export type OrderFeedbackState = {
  fieldErrors?: Record<string, string[] | undefined>;
  message?: string;
  submitted?: boolean;
};

export type OrderCancellationState = {
  cancelled?: boolean;
  emailWarning?: string;
  message?: string;
};

export type OrderReceivedState = {
  received?: boolean;
  message?: string;
};

const paymentProofInput = z.object({ gcashReferenceNumber: referenceNumberField, ...confirmedProofFields, confirmedAmount: confirmedAmountField, confirmedPaidAt: confirmedPaidAtField });
const cancellationInput = z.object({ orderId: positiveIntegerField("Order ID"), reason: z.string().trim().min(1, "Tell us why you are cancelling.").max(1000) });

/** Cancels a Customer-owned Order when its status is still before dispatch. */
export async function cancelOrder(
  _previousState: OrderCancellationState,
  formData: FormData,
): Promise<OrderCancellationState> {
  void _previousState;
  const parsed = cancellationInput.safeParse({ orderId: formData.get("orderId"), reason: formData.get("reason") });
  if (!parsed.success) return { message: parsed.error.issues.find((i) => i.path[0] === "reason")?.message ?? "We couldn't cancel this Order. Please try again." };

  const customer = await requireCustomer();
  let order: Order;
  try {
    order = await createOrderStore(getDatabase()).cancel(customer.userId, parsed.data.orderId, parsed.data.reason);
  } catch (error) {
    if (error instanceof OrderTransitionError) {
      return { message: "This Order can no longer be cancelled." };
    }
    console.error("Cancelling Order failed", error);
    return { message: "We couldn't cancel this Order. Please try again." };
  }

  scheduleOrdersChanged();
  try {
    await sendOrderCancelledEmail(customer.email, order);
  } catch (error) {
    console.error("Order-cancelled email could not be sent", error);
    revalidatePath("/profile/orders");
    return {
      cancelled: true,
      emailWarning: "Your Order was cancelled, but we couldn't send its confirmation email.",
    };
  }

  revalidatePath("/profile/orders");
  return { cancelled: true };
}

/** Bound to an Order id (`submitPaymentProof.bind(null, order.id)`) before use as a Form Action. */
export async function submitPaymentProof(
  orderId: number,
  _previousState: PaymentProofState,
  formData: FormData,
): Promise<PaymentProofState> {
  const customer = await requireCustomer();
  const parsed = paymentProofInput.safeParse({
    gcashReferenceNumber: formData.get("gcashReferenceNumber"),
    confirmedAmount: formData.get("confirmedAmount"),
    confirmedPaidAt: formData.get("confirmedPaidAt"),
    confirmedRecipient: formData.get("confirmedRecipient") || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const accountId = String(formData.get("accountId") ?? "");
  const account = accountId ? await loadPaymentAccountSnapshot(accountId) : undefined;
  if (!account) return { fieldErrors: { accountId: ["Choose the account you paid."] } };
  const submissionKey = String(formData.get("submissionKey") ?? "").slice(0, 64) || undefined;

  const screenshot = formData.get("screenshot");
  if (!(screenshot instanceof File) || screenshot.size === 0) {
    return { fieldErrors: { screenshot: ["Upload a screenshot of your payment."] } };
  }
  try {
    validatePaymentProofScreenshot(screenshot);
  } catch (error) {
    return { fieldErrors: { screenshot: [error instanceof Error ? error.message : "We couldn't read that screenshot."] } };
  }
  const files = gatewayTicketFiles();
  let screenshotFileId: string;
  try {
    screenshotFileId = await uploadPaymentProofScreenshot(screenshot, files);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("That file isn't")) return { fieldErrors: { screenshot: [error.message] } };
    console.error("A payment-proof screenshot could not be stored in file-storage", error);
    return { message: "We couldn't upload that screenshot. Please try again." };
  }

  try {
    await createOrderStore(getDatabase()).submitPaymentProof(customer.userId, orderId, {
      ...parsed.data,
      confirmedAmountInCentavos: parsed.data.confirmedAmount,
      gcashReferenceNumber: parsed.data.gcashReferenceNumber,
      screenshotFileId,
      account,
      submissionKey,
      discardFile: (fileId) => files.remove(fileId),
    });
  } catch (error) {
    // Nothing was saved, so the uploaded screenshot is unused: remove it rather than leave it in file-storage.
    await files.remove(screenshotFileId).catch((removal) => console.error("An unused payment-proof screenshot could not be removed", removal));
    return { message: error instanceof Error ? error.message : "We couldn't submit your payment proof." };
  }

  scheduleOrdersChanged();
  scheduleStaffSignal("Payment");
  revalidatePath("/profile/orders");
  return { message: "Payment proof submitted. Your order shows Pending Verification, and we'll email you once it's verified.", submitted: true };
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
    await createOrderFeedbackStore(getDatabase(), { queueThankYou: queueFeedbackThankYou }).submit(
      customer.userId,
      parsed.data,
      customer.email,
    );
  } catch (error) {
    if (error instanceof OrderFeedbackNotAvailableError || error instanceof OrderFeedbackAlreadySubmittedError) {
      return { message: error.message };
    }
    console.error("Saving Order Feedback failed", error);
    return { message: "We couldn't save your Feedback. Please try again." };
  }

  if (parsed.data.rating <= 3) scheduleStaffSignal("Feedback");
  revalidatePath("/profile/orders");
  return { submitted: true };
}

/** Irreversible: ends the Customer's right to a Return on a delivered Order. */
export async function markOrderReceived(orderId: number): Promise<OrderReceivedState> {
  const parsed = positiveIntegerField("Order ID").safeParse(String(orderId));
  if (!parsed.success) return { message: "We couldn't mark this Order received. Please try again." };

  const customer = await requireCustomer();
  try {
    await createOrderReceiptStore(getDatabase()).markReceived(customer.userId, parsed.data);
  } catch (error) {
    if (error instanceof OrderReceiptNotFoundError || error instanceof OrderReceiptConflictError) {
      return { message: error.message };
    }
    console.error("Order could not be marked received", error);
    return { message: "We couldn't mark this Order received. Please try again." };
  }

  revalidatePath("/profile/orders");
  scheduleOrdersChanged();
  return { received: true };
}

/** The address for the signed-in Customer's live Orders line, or null when it cannot be issued; the page then just stays as loaded. */
export async function ordersLiveUrl(): Promise<string | null> {
  const customer = await requireCustomer();
  try {
    return await liveOrdersUrl(customer.userId);
  } catch (error) {
    console.error("Live Orders pass could not be issued", error);
    return null;
  }
}

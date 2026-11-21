"use server";

import { confirmedProofFields, confirmedAmountField, confirmedPaidAtField } from "@/lib/orders/payment-proof";

import { scheduleOrdersChanged } from "@/lib/orders/staff-signal";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { CancelRequestError } from "@/lib/orders/cancel-requests";
import {
  OrderFeedbackAlreadySubmittedError,
  OrderFeedbackNotAvailableError,
  createOrderFeedbackStore,
} from "@/lib/orders/feedback";
import { scheduleStaffSignal } from "@/lib/notifications/staff-signal";
import { queueFeedbackThankYou } from "@/lib/notifications/gateway";
import { orderFeedbackInput } from "@/lib/orders/feedback-input";
import { createOrderReceiptStore, OrderReceiptConflictError, OrderReceiptNotFoundError } from "@/lib/orders/receipt";
import { createOrderStore, OrderTransitionError } from "@/lib/orders/orders";
import { referenceNumberField, uploadPaymentProofScreenshot, validatePaymentProofScreenshot } from "@/lib/orders/payment-proof";
import { loadPaymentAccountSnapshot } from "@/lib/orders/payment-accounts";
import { liveOrdersUrl } from "@/lib/orders/live";
import { gatewayTicketFiles } from "@/lib/support/ticket-files";
import { processPaymentProof } from "@/lib/orders/process-payment-proof";
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
  requested?: boolean;
  message?: string;
};

export type OrderReceivedState = {
  received?: boolean;
  message?: string;
};

const cancellationInput = z.object({ orderId: positiveIntegerField("Order ID"), reason: z.string().trim().min(1, "Tell us why you are cancelling.").max(1000) });

/** Asks to cancel a Customer-owned Order that is still before payment and preparing. Staff decide; the Order is unchanged until they approve. */
export async function cancelOrder(
  _previousState: OrderCancellationState,
  formData: FormData,
): Promise<OrderCancellationState> {
  void _previousState;
  const parsed = cancellationInput.safeParse({ orderId: formData.get("orderId"), reason: formData.get("reason") });
  if (!parsed.success) return { message: parsed.error.issues.find((i) => i.path[0] === "reason")?.message ?? "We couldn't send your request. Please try again." };

  const customer = await requireCustomer();
  try {
    await createOrderStore(getDatabase()).requestCancel(customer.userId, parsed.data.orderId, parsed.data.reason);
  } catch (error) {
    if (error instanceof OrderTransitionError) {
      return { message: "This Order can no longer be cancelled here." };
    }
    console.error("Requesting Order cancellation failed", error);
    return { message: "We couldn't send your request. Please try again." };
  }

  scheduleOrdersChanged();
  revalidatePath("/profile/orders");
  return { requested: true };
}

/** Takes back a waiting cancellation request so the Order carries on. */
export async function withdrawCancelRequest(orderId: number): Promise<{ ok: true } | { ok: false; message: string }> {
  const id = positiveIntegerField("Order ID").safeParse(orderId);
  if (!id.success) return { ok: false, message: "We couldn't find that Order." };
  const customer = await requireCustomer();
  try {
    await createOrderStore(getDatabase()).withdrawCancel(customer.userId, id.data);
  } catch (error) {
    if (error instanceof CancelRequestError) return { ok: false, message: error.message };
    console.error("Withdrawing cancellation request failed", error);
    return { ok: false, message: "We couldn't withdraw your request. Please try again." };
  }
  scheduleOrdersChanged();
  revalidatePath("/profile/orders");
  return { ok: true };
}

/** Bound to an Order id (`submitPaymentProof.bind(null, order.id)`) before use as a Form Action. */
export async function submitPaymentProof(
  orderId: number,
  _previousState: PaymentProofState,
  formData: FormData,
): Promise<PaymentProofState> {
  return processPaymentProof(orderId, formData);
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

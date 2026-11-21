import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { scheduleStaffSignal } from "@/lib/notifications/staff-signal";
import { loadPaymentAccountSnapshot } from "@/lib/orders/payment-accounts";
import { createOrderStore } from "@/lib/orders/orders";
import { confirmedAmountField, confirmedPaidAtField, confirmedProofFields, referenceNumberField, uploadPaymentProofScreenshot, validatePaymentProofScreenshot } from "@/lib/orders/payment-proof";
import { scheduleOrdersChanged } from "@/lib/orders/staff-signal";
import { gatewayTicketFiles } from "@/lib/support/ticket-files";

const paymentProofInput = z.object({ gcashReferenceNumber: referenceNumberField, ...confirmedProofFields, confirmedAmount: confirmedAmountField, confirmedPaidAt: confirmedPaidAtField });

export type PaymentProofState = {
  message?: string;
  submitted?: boolean;
  fieldErrors?: Record<string, string[] | undefined>;
};

/** Saves a Customer's payment proof; shared by the Form Action and the upload route that reports progress. */
export async function processPaymentProof(orderId: number, formData: FormData): Promise<PaymentProofState> {
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


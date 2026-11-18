import { getDatabase } from "../db";
import { createOrderStore, type Order } from "../orders/orders";
import { sendOrderDeliveryConfirmedEmail } from "./order-delivery-confirmed-email";
import { sendOrderOnlineDeliveryConfirmedEmail } from "./order-online-delivery-confirmed-email";
import { sendOrderOnlinePickupConfirmedEmail } from "./order-online-pickup-confirmed-email";
import { sendOrderPickupConfirmedEmail } from "./order-pickup-confirmed-email";
import { FULFILMENT_EMAIL_KINDS, sendFulfilmentEmail, type FulfilmentEmailKind } from "./fulfilment-emails";
import { PAYMENT_EMAIL_KINDS, sendPaymentEmail, type PaymentEmailKind } from "./payment-emails";
import { resendFailedEmail, retryDueEmails, type ResendResult } from "./outcomes";

const senders: Record<string, (recipient: string, order: Order, email?: { id: string }, occurrence?: string) => Promise<{ messageId?: string } | void>> = {
  "pickup-confirmed": sendOrderPickupConfirmedEmail,
  "online-pickup-confirmed": sendOrderOnlinePickupConfirmedEmail,
  "delivery-confirmed": sendOrderDeliveryConfirmedEmail,
  "online-delivery-confirmed": sendOrderOnlineDeliveryConfirmedEmail,
  ...Object.fromEntries(PAYMENT_EMAIL_KINDS.map((kind) => [kind, (recipient: string, order: Order, email?: { id: string }, occurrence?: string) => sendPaymentEmail(kind as PaymentEmailKind, recipient, order, email, occurrence)])),
  ...Object.fromEntries(FULFILMENT_EMAIL_KINDS.map((kind) => [kind, (recipient: string, order: Order, email?: { id: string }) => sendFulfilmentEmail(kind as FulfilmentEmailKind, recipient, order, email)])),
};

/** Sends the stored kind of confirmation email again from the Order as it is now. Throws when it cannot be built. */
export async function resendOrderEmail(orderId: number, kind: string, db = getDatabase(), email?: { id: string }, occurrence = "") {
  const send = senders[kind];
  if (!send) throw new Error(`Unknown email kind ${kind}`);
  const store = createOrderStore(db);
  const [order, recipient] = await Promise.all([store.getById(orderId), store.customerEmailForOrder(orderId)]);
  if (!order) throw new Error("Order was not found.");
  if (!recipient) throw new Error("The Customer has no email address.");
  return send(recipient, order, email, occurrence);
}

/** A Staff or Manager Resend of one failed email occurrence. Reconciles first; never sends twice; never touches the Order. */
export async function resendStaffEmail(orderId: number, kind: string, occurrence: string, db = getDatabase()): Promise<ResendResult> {
  return resendFailedEmail(orderId, kind, occurrence, (email) => resendOrderEmail(orderId, kind, db, email, occurrence), db);
}

/** Entry point for the scheduled job. The Order stays confirmed whatever happens here. */
export function retryFailedOrderEmails(db = getDatabase()) {
  return retryDueEmails((orderId, kind, occurrence, email) => resendOrderEmail(orderId, kind, db, email, occurrence), db);
}

import { getDatabase } from "../db";
import { createOrderStore, type Order } from "../orders/orders";
import { sendOrderDeliveryConfirmedEmail } from "./order-delivery-confirmed-email";
import { sendOrderOnlineDeliveryConfirmedEmail } from "./order-online-delivery-confirmed-email";
import { sendOrderOnlinePickupConfirmedEmail } from "./order-online-pickup-confirmed-email";
import { sendOrderPickupConfirmedEmail } from "./order-pickup-confirmed-email";
import { retryDueEmails } from "./outcomes";

const senders: Record<string, (recipient: string, order: Order) => Promise<void>> = {
  "pickup-confirmed": sendOrderPickupConfirmedEmail,
  "online-pickup-confirmed": sendOrderOnlinePickupConfirmedEmail,
  "delivery-confirmed": sendOrderDeliveryConfirmedEmail,
  "online-delivery-confirmed": sendOrderOnlineDeliveryConfirmedEmail,
};

/** Sends the stored kind of confirmation email again from the Order as it is now. Throws when it cannot be built. */
export async function resendOrderEmail(orderId: number, kind: string, db = getDatabase()) {
  const send = senders[kind];
  if (!send) throw new Error(`Unknown email kind ${kind}`);
  const store = createOrderStore(db);
  const [order, recipient] = await Promise.all([store.getById(orderId), store.customerEmailForOrder(orderId)]);
  if (!order) throw new Error("Order was not found.");
  if (!recipient) throw new Error("The Customer has no email address.");
  await send(recipient, order);
}

/** Entry point for the scheduled job. The Order stays confirmed whatever happens here. */
export function retryFailedOrderEmails(db = getDatabase()) {
  return retryDueEmails((orderId, kind) => resendOrderEmail(orderId, kind, db), db);
}

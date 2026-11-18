import { and, eq, isNull, like, sql } from "drizzle-orm";

import { getDatabase } from "../db";
import { customerNotifications, orderEmailOutcomes, stockReservations } from "../db/schema";
import { createOrderStore } from "../orders/orders";
import { sendOnceAndRecord } from "./outcomes";
import { sendPaymentEmail } from "./payment-emails";

/**
 * Emails every Customer whose unpaid Order the expiry job cancelled and whose stock is back. The expiry writes one
 * `order.expired:<id>` notification in the same transaction as the cancellation, so this finds them without a second
 * queue; the email's claim row makes a repeat run (or a retry) send nothing twice. A failure is kept for the retry job.
 */
export async function sendExpiredOrderEmails(db = getDatabase(), limit = 25): Promise<number> {
  const due = await db.select({ orderId: customerNotifications.orderId }).from(customerNotifications)
    .leftJoin(orderEmailOutcomes, and(eq(orderEmailOutcomes.orderId, customerNotifications.orderId), eq(orderEmailOutcomes.kind, "payment-expired")))
    .leftJoin(stockReservations, eq(stockReservations.orderId, customerNotifications.orderId))
    .where(and(like(customerNotifications.idempotencyKey, "order.expired:%"), isNull(orderEmailOutcomes.orderId), sql`(${stockReservations.state} is null or ${stockReservations.state} = 'released')`))
    .limit(limit);
  const store = createOrderStore(db);
  let sent = 0;
  for (const { orderId } of due) {
    if (orderId === null) continue;
    try {
      const [order, recipient] = await Promise.all([store.getById(orderId), store.customerEmailForOrder(orderId)]);
      if (!order || !recipient) continue;
      if (await sendOnceAndRecord(orderId, "payment-expired", (email) => sendPaymentEmail("payment-expired", recipient, order, email), db) === "sent") sent += 1;
    } catch (error) {
      console.error("Order-expired email outcome could not be recorded", error);
    }
  }
  return sent;
}

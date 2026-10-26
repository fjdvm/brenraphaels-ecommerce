import { and, eq, isNull } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { customerNotifications } from "../db/schema";
import { required } from "../gateway";
import { sendAppNotification } from "./gateway";

/** Retries stored Notifications, including ambiguous timeouts, with their original stable keys. */
export async function sendPendingCustomerNotifications<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>, orderId?: number): Promise<number> {
  const pending = await db.select().from(customerNotifications)
    .where(and(isNull(customerNotifications.acceptedAt), orderId === undefined ? undefined : eq(customerNotifications.orderId, orderId)))
    .orderBy(customerNotifications.createdAt, customerNotifications.idempotencyKey)
    // Bound an outage run to ten gateway timeouts (five seconds each).
    .limit(10);
  let sent = 0;
  for (const notification of pending) {
    try {
      await sendAppNotification({
        idempotencyKey: notification.idempotencyKey,
        userId: notification.customerId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        link: `${required("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "")}${notification.link}`,
      });
      await db.update(customerNotifications).set({ acceptedAt: new Date() })
        .where(eq(customerNotifications.idempotencyKey, notification.idempotencyKey));
      sent += 1;
    } catch (error) {
      console.error(`Customer Notification ${notification.idempotencyKey} will be retried`, error);
    }
  }
  return sent;
}

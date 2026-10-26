import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { customers, orders, type orderReturns } from "../db/schema";
import { required } from "../gateway";
import { type AppEmail, type AppNotification, sendAppEmail, sendAppNotification } from "../notifications/gateway";
import { sendPendingCustomerNotifications } from "../notifications/outbox";

type ReturnRow = typeof orderReturns.$inferSelect;

/** Statuses that tell the Customer something; a Return the Customer cancels sends nothing. */
const noticeStatuses = ["requested", "approved", "declined", "goods received", "refunded", "replaced"] as const;

/** One message, worded once for both the email and the in-app Notification. */
export function returnNoticeContent(record: ReturnRow, siteUrl: string) {
  const number = `RMA-${record.id}`;
  const link = `${siteUrl.replace(/\/$/, "")}/profile/orders?order=${record.orderId}`;
  const button = { label: "View your Return", link };
  switch (record.status) {
    case "requested":
      return { title: `Return ${number} requested`, body: `We've received your Return request ${number}. Our team will review it and let you know.`, button };
    case "approved": {
      const resolution = record.finalResolution ?? record.preferredResolution;
      const changed = resolution !== record.preferredResolution
        ? ` You asked for a ${record.preferredResolution}, but we'll give you a ${resolution} instead.` : "";
      const goods = record.goodsRequired ? "Please send the goods back to us." : "You don't need to send the goods back.";
      return { title: `Return ${number} approved`, body: `Your Return ${number} was approved as a ${resolution}.${changed} ${goods}`, button };
    }
    case "declined":
      return { title: `Return ${number} declined`, body: `We couldn't approve your Return ${number}. Reason: ${record.declineReason ?? "not given"}`, button };
    case "goods received":
      return { title: `Return ${number}: goods received`, body: `We've received the goods for your Return ${number} and will complete it shortly.`, button };
    case "refunded":
      return { title: `Return ${number} refunded`, body: `Your Return ${number} has been refunded. The refund proof is in your Return.`, button };
    case "replaced":
      return { title: `Return ${number} replaced`, body: `We've sent a replacement for your Return ${number}.`, button };
    default:
      return null;
  }
}

export type ReturnNoticeSenders = {
  email(email: AppEmail): Promise<void>;
  notification(notification: AppNotification): Promise<void>;
};

const gatewaySenders: ReturnNoticeSenders = { email: (e) => sendAppEmail(e), notification: (n) => sendAppNotification(n) };

/**
 * Tells the Customer about a Return that just changed: one email and one Notification. Runs after the change has
 * committed and never throws, so a mail failure cannot undo or hide the decision; failures are logged.
 */
export async function notifyReturnChange<TQueryResult extends PgQueryResultHKT, TSchema extends Record<string, unknown>>(
  db: PgDatabase<TQueryResult, TSchema>, record: ReturnRow, senders: ReturnNoticeSenders = gatewaySenders,
): Promise<void> {
  if (!(noticeStatuses as readonly string[]).includes(record.status)) return;
  try {
    const [recipient] = await db.select({ id: customers.id, email: customers.email }).from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id)).where(eq(orders.id, record.orderId));
    const content = returnNoticeContent(record, required("NEXT_PUBLIC_SITE_URL"));
    if (!recipient || !content) return;
    const { title, body, button } = content;
    const results = await Promise.allSettled([
      senders.email({ to: recipient.email, title, body, button }),
      sendPendingCustomerNotifications(db, record.orderId, senders.notification),
    ]);
    for (const result of results) if (result.status === "rejected") console.error(`Return ${record.id} notice failed`, result.reason);
  } catch (error) {
    console.error(`Return ${record.id} notice failed`, error);
  }
}

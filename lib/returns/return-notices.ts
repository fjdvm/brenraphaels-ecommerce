import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { customers, orders, type orderReturns } from "../db/schema";
import { loadRefundedReturn, RETURN_REFUNDED_EMAIL_KIND, sendReturnRefundedEmail } from "../email/return-refunded-email";
import { sendOnceAndRecord } from "../email/outcomes";
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
  /** The Refunded email (epic-crms#616): its own content and one stable id per Return, so it is never sent twice. */
  refundEmail?(db: PgDatabase<PgQueryResultHKT, Record<string, unknown>>, record: ReturnRow, recipient: string): Promise<unknown>;
};

async function sendRefundEmailOnce(db: PgDatabase<PgQueryResultHKT, Record<string, unknown>>, record: ReturnRow, recipient: string) {
  const refund = await loadRefundedReturn(db, record.id);
  if (!refund) throw new Error(`Return ${record.id} has no refund record to email.`);
  return sendOnceAndRecord(record.orderId, RETURN_REFUNDED_EMAIL_KIND, (email) => sendReturnRefundedEmail(recipient, refund, email), db as never, String(record.id));
}

const gatewaySenders: ReturnNoticeSenders = { email: (e) => sendAppEmail(e), notification: (n) => sendAppNotification(n), refundEmail: sendRefundEmailOnce };

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
      record.status === "refunded" && senders.refundEmail
        ? senders.refundEmail(db as never, record, recipient.email)
        : senders.email({ to: recipient.email, title, body, button }),
      sendPendingCustomerNotifications(db, record.orderId, senders.notification),
    ]);
    for (const result of results) if (result.status === "rejected") console.error(`Return ${record.id} notice failed`, result.reason);
  } catch (error) {
    console.error(`Return ${record.id} notice failed`, error);
  }
}

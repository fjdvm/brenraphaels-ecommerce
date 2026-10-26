import { and, eq, inArray, isNotNull, lte, notExists } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { feedbackRequestContent } from "../notifications/feedback-request-content";
import type { AuditEvent } from "../audit/gateway";
import { customerNotifications, customers, feedbackRequests, orderFeedback, orders } from "../db/schema";

/** How long after delivery a Customer is asked for Feedback. */
export const feedbackRequestAfterDays = 2;

export type DueFeedbackRequest = {
  orderId: number;
  customerId: string;
  customerName: string;
  email: string;
};

export type FeedbackRequestStore = {
  /** Delivered Orders delivered at or before `deliveredBefore`, with no request recorded and no Feedback. */
  due(deliveredBefore: Date): Promise<DueFeedbackRequest[]>;
  /** Records the request; a second record for the same Order is ignored. */
  record(request: DueFeedbackRequest, sentAt: Date): Promise<void>;
};

export function createFeedbackRequestStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): FeedbackRequestStore {
  return {
    async due(deliveredBefore) {
      return db
        .select({
          orderId: orders.id,
          customerId: customers.id,
          customerName: customers.fullName,
          email: customers.email,
        })
        .from(orders)
        .innerJoin(customers, eq(orders.customerId, customers.id))
        .where(and(
          inArray(orders.status, ["delivered", "received"]),
          isNotNull(orders.deliveredAt),
          lte(orders.deliveredAt, deliveredBefore),
          notExists(db.select({ one: feedbackRequests.orderId }).from(feedbackRequests).where(eq(feedbackRequests.orderId, orders.id))),
          notExists(db.select({ one: orderFeedback.orderId }).from(orderFeedback).where(eq(orderFeedback.orderId, orders.id))),
        ))
        .orderBy(orders.id);
    },
    async record(request, sentAt) {
      await db.transaction(async (tx) => {
        const recorded = await tx.insert(feedbackRequests)
          .values({ orderId: request.orderId, customerId: request.customerId, sentAt })
          .onConflictDoNothing().returning();
        if (!recorded.length) return;
        const content = feedbackRequestContent(request.orderId, "");
        await tx.insert(customerNotifications).values({
          idempotencyKey: `feedback.request:${request.orderId}`, orderId: request.orderId,
          customerId: request.customerId, type: "feedback.request",
          title: content.title, body: content.body, link: content.button.link,
        }).onConflictDoNothing();
      });
    },
  };
}

/** The audit event for one sent request: the automated process asked the Customer about the Order. */
export function feedbackRequestSentEvent(request: DueFeedbackRequest, sentAt: Date): AuditEvent {
  return {
    source: "Ecommerce",
    action: "feedback.request_sent",
    outcome: "success",
    actor: { type: "system", id: "feedback-request-job", display_name: "Feedback request job" },
    subject: { type: "customer", id: request.customerId, display_name: request.customerName },
    target: { type: "order", id: String(request.orderId), display_name: `Order #${request.orderId}` },
    description: `Asked ${request.customerName} for Feedback on Order #${request.orderId}`,
    occurred_at: sentAt.toISOString(),
    idempotency_key: `feedback.request_sent:order-${request.orderId}`,
  };
}

/**
 * Asks every Customer whose Order was delivered 2 or more days ago, once per Order. A request is recorded only
 * after it was sent, so a failed send is retried by the next run and one failure does not stop the rest. A failed
 * audit write is logged and never fails the run. Returns how many requests were sent.
 */
export async function sendDueFeedbackRequests(
  now: Date,
  dependencies: {
    store: FeedbackRequestStore;
    send(request: DueFeedbackRequest): Promise<void>;
    audit(event: AuditEvent): Promise<void>;
  },
): Promise<number> {
  const cutoff = new Date(now.getTime() - feedbackRequestAfterDays * 24 * 60 * 60 * 1000);
  let sent = 0;
  for (const request of await dependencies.store.due(cutoff)) {
    try {
      await dependencies.send(request);
    } catch (error) {
      console.error(`Feedback request for Order #${request.orderId} could not be sent`, error);
      continue;
    }
    try {
      await dependencies.store.record(request, now);
    } catch (error) {
      console.error(`Feedback request for Order #${request.orderId} could not be recorded`, error);
      continue;
    }
    sent += 1;
    try {
      await dependencies.audit(feedbackRequestSentEvent(request, now));
    } catch (error) {
      console.error("Feedback request audit event could not be written", error);
    }
  }
  return sent;
}

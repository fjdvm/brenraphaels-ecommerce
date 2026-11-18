import { and, eq, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { orderFeedback, orders } from "../db/schema";

export type OrderFeedback = {
  orderId: number;
  rating: number;
  comment: string;
  createdAt: Date;
};

export type SubmitOrderFeedback = {
  orderId: number;
  rating: number;
  comment: string;
};

export class OrderFeedbackNotAvailableError extends Error {
  constructor() {
    super("Feedback is available after your Order has been delivered.");
  }
}

export class OrderFeedbackAlreadySubmittedError extends Error {
  constructor() {
    super("Feedback has already been submitted for this Order.");
  }
}

/** Queues the thank-you email for a Customer's Feedback; may fail without affecting the submit. */
export type QueueThankYou = (recipient: string, rating: number) => Promise<void>;

export type OrderFeedbackStore = {
  /** `recipient` is the Customer's email; when given, a thank-you email is queued after saving. */
  submit(customerId: string, input: SubmitOrderFeedback, recipient?: string): Promise<OrderFeedback>;
  forOrder(customerId: string, orderId: number): Promise<OrderFeedback | undefined>;
};

/** Stores Order feedback only for its owner after delivery. */
export function createOrderFeedbackStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>, deps: { queueThankYou?: QueueThankYou } = {}): OrderFeedbackStore {
  async function forOrder(customerId: string, orderId: number) {
    const [feedback] = await db
      .select({
        orderId: orderFeedback.orderId,
        rating: orderFeedback.rating,
        comment: orderFeedback.comment,
        createdAt: orderFeedback.createdAt,
      })
      .from(orderFeedback)
      .innerJoin(orders, eq(orderFeedback.orderId, orders.id))
      .where(and(eq(orderFeedback.orderId, orderId), eq(orders.customerId, customerId)));
    return feedback;
  }

  async function submit(customerId: string, input: SubmitOrderFeedback, recipient?: string) {
    const [order] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.customerId, customerId), inArray(orders.status, ["delivered", "collected", "received"])));
    if (!order) throw new OrderFeedbackNotAvailableError();

    const [feedback] = await db
      .insert(orderFeedback)
      .values(input)
      .onConflictDoNothing()
      // Sentiment is for Staff in CREOMS only; the storefront never reads or returns it.
      .returning({
        orderId: orderFeedback.orderId,
        rating: orderFeedback.rating,
        comment: orderFeedback.comment,
        createdAt: orderFeedback.createdAt,
      });
    if (!feedback) throw new OrderFeedbackAlreadySubmittedError();

    if (recipient && deps.queueThankYou) {
      try {
        await deps.queueThankYou(recipient, feedback.rating);
      } catch (error) {
        console.error("Feedback thank-you email could not be queued", error);
      }
    }
    return feedback;
  }

  return { submit, forOrder };
}

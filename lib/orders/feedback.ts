import { and, eq } from "drizzle-orm";
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

export type OrderFeedbackStore = {
  submit(customerId: string, input: SubmitOrderFeedback): Promise<OrderFeedback>;
  forOrder(customerId: string, orderId: number): Promise<OrderFeedback | undefined>;
};

/** Stores Order feedback only for its owner after delivery. */
export function createOrderFeedbackStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): OrderFeedbackStore {
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

  async function submit(customerId: string, input: SubmitOrderFeedback) {
    const [order] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.customerId, customerId), eq(orders.status, "delivered")));
    if (!order) throw new OrderFeedbackNotAvailableError();

    const [feedback] = await db
      .insert(orderFeedback)
      .values(input)
      .onConflictDoNothing()
      .returning();
    if (!feedback) throw new OrderFeedbackAlreadySubmittedError();
    return feedback;
  }

  return { submit, forOrder };
}

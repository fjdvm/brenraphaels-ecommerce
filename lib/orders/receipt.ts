import { and, eq, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { orders, orderReturns } from "../db/schema";

export class OrderReceiptNotFoundError extends Error {
  constructor() {
    super("Order was not found.");
  }
}

export class OrderReceiptConflictError extends Error {}

/** Customer identity must come from the authenticated storefront session. */
export function createOrderReceiptStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>) {
  async function markReceived(customerId: string, orderId: number) {
    return db.transaction(async (tx) => {
      // Return creation must lock this same Order before checking eligibility
      // and inserting its Return, so only one of the two actions can succeed.
      const [order] = await tx.select({ status: orders.status }).from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId))).for("update");
      if (!order) throw new OrderReceiptNotFoundError();
      if (order.status !== "delivered") {
        throw new OrderReceiptConflictError("Only a delivered Order can be marked received.");
      }

      const [activeReturn] = await tx.select({ id: orderReturns.id }).from(orderReturns)
        .where(and(eq(orderReturns.orderId, orderId), inArray(orderReturns.status, ["requested", "approved", "goods received"])))
        .limit(1);
      if (activeReturn) {
        throw new OrderReceiptConflictError("An Order with a Return in progress cannot be marked received.");
      }

      // Receipt has no deadline and changes only status, preserving delivery
      // time, payment data, Returns and the original Feedback request timer.
      const [received] = await tx.update(orders).set({ status: "received" })
        .where(eq(orders.id, orderId)).returning({ id: orders.id });
      return { id: received.id, status: "received" as const };
    });
  }

  return { markReceived };
}

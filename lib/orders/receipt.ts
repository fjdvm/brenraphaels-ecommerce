import { and, eq, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { orders, orderReturns } from "../db/schema";

export class OrderReceiptNotFoundError extends Error {
  constructor() {
    super("Order was not found.");
  }
}

export class OrderReceiptConflictError extends Error {}

const returnInProgressStatuses = ["requested", "approved", "goods received"] as const;

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
      if (order.status !== "delivered" && order.status !== "collected") {
        throw new OrderReceiptConflictError("Only a delivered or picked up Order can be marked received.");
      }

      const [activeReturn] = await tx.select({ id: orderReturns.id }).from(orderReturns)
        .where(and(eq(orderReturns.orderId, orderId), inArray(orderReturns.status, [...returnInProgressStatuses])))
        .limit(1);
      if (activeReturn) {
        throw new OrderReceiptConflictError("An Order with a Return in progress cannot be marked received.");
      }

      // Receipt has no deadline; its timestamp starts photo retention, preserving delivery
      // or pickup time (the sale is already counted, no timer restarts), payment data, Returns and the original Feedback request timer.
      const [received] = await tx.update(orders).set({ status: "received", receivedAt: new Date() })
        .where(eq(orders.id, orderId)).returning({ id: orders.id });
      return { id: received.id, status: "received" as const };
    });
  }

  /** Ids of the Customer's Orders that have a Return in progress. */
  async function orderIdsWithReturnInProgress(customerId: string) {
    const rows = await db.selectDistinct({ orderId: orderReturns.orderId }).from(orderReturns)
      .innerJoin(orders, eq(orders.id, orderReturns.orderId))
      .where(and(eq(orders.customerId, customerId), inArray(orderReturns.status, [...returnInProgressStatuses])));
    return new Set(rows.map((row) => row.orderId));
  }

  return { markReceived, orderIdsWithReturnInProgress };
}

import { eq, desc } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { orderCancelRequests, orders } from "../db/schema";

/** Shown to Staff and the Customer when something tries to change an Order whose cancellation request is waiting. */
export const CANCEL_REQUEST_FROZEN = "A cancellation request is waiting for a decision on this Order. Approve or decline it first.";

/** A cancellation request could not be decided, withdrawn or found. */
export class CancelRequestError extends Error {}

/** What a Customer and Staff see about a Customer's cancellation request on one Order. */
export type CancelRequestView = {
  requestId: string;
  status: "waiting" | "approved" | "declined" | "withdrawn";
  reason: string;
  declineReason: string | null;
  decidedByName: string | null;
  requestedAt: string;
};

/** The latest request per Order for one Customer; Orders with none are absent. */
export async function listCustomerCancelRequests<T extends PgQueryResultHKT, S extends Record<string, unknown>>(
  db: PgDatabase<T, S>, customerId: string,
): Promise<Map<number, CancelRequestView>> {
  const rows = await db.select({ r: orderCancelRequests }).from(orderCancelRequests)
    .innerJoin(orders, eq(orders.id, orderCancelRequests.orderId)).where(eq(orders.customerId, customerId)).orderBy(desc(orderCancelRequests.createdAt));
  const latest = new Map<number, CancelRequestView>();
  for (const { r } of rows) {
    if (latest.has(r.orderId)) continue;
    latest.set(r.orderId, { requestId: r.id, status: r.status as CancelRequestView["status"], reason: r.reason, declineReason: r.declineReason,
      decidedByName: r.decidedByName, requestedAt: r.createdAt.toISOString() });
  }
  return latest;
}

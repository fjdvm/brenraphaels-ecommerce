import { eq, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { orderCancellations, orders } from "../db/schema";

/** What a Customer sees about a cancellation request on their own dispatched Order. */
export type CancellationStatus = { status: "waiting-manager" | "approved" | "declined" | "cancelled"; declineReason: string | null };

/** The Customer's cancellation requests by Order number; Orders with none are absent. */
export async function listCustomerCancellations<T extends PgQueryResultHKT, S extends Record<string, unknown>>(
  db: PgDatabase<T, S>, customerId: string,
): Promise<Map<number, CancellationStatus>> {
  const mine = await db.select({ id: orders.id }).from(orders).where(eq(orders.customerId, customerId));
  const ids = mine.map((o) => o.id);
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(orderCancellations).where(inArray(orderCancellations.orderId, ids));
  return new Map(rows.map((r) => [r.orderId, {
    status: (r.status === "waiting-manager" ? r.approvalStatus : r.status === "cancelled" ? "cancelled" : "approved") as CancellationStatus["status"],
    declineReason: r.declineReason,
  }]));
}

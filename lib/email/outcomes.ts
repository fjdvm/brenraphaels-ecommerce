import { and, eq, sql } from "drizzle-orm";

import { getDatabase } from "../db";
import { orderEmailOutcomes } from "../db/schema";

type Database = ReturnType<typeof getDatabase>;

/**
 * Sends one kind of email at most once per Order and records the outcome on the Order. The first insert claims the
 * send; a repeat finds the row and does nothing, whatever its outcome, so a failed send is never retried here.
 * Returns the outcome, or "skipped" when another confirmation already claimed it.
 */
export async function sendOnceAndRecord(
  orderId: number,
  kind: string,
  send: () => Promise<void>,
  db: Database = getDatabase(),
): Promise<"sent" | "failed" | "skipped"> {
  const claimed = await db
    .insert(orderEmailOutcomes)
    .values({ orderId, kind, status: "sending" })
    .onConflictDoNothing()
    .returning({ orderId: orderEmailOutcomes.orderId });
  if (claimed.length === 0) return "skipped";

  const where = and(eq(orderEmailOutcomes.orderId, orderId), eq(orderEmailOutcomes.kind, kind));
  try {
    await send();
    await db.update(orderEmailOutcomes).set({ status: "sent", reason: null, updatedAt: sql`now()` }).where(where);
    return "sent";
  } catch (error) {
    const reason = (error instanceof Error ? error.message : String(error)).slice(0, 300);
    await db.update(orderEmailOutcomes).set({ status: "failed", reason, updatedAt: sql`now()` }).where(where);
    return "failed";
  }
}

import { and, eq, inArray, isNotNull, isNull, lte, notExists, or } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { orders, orderReturns } from "../db/schema";
import { required } from "../gateway";

/** file-storage deletion is idempotent, including a retry after an uncertain response. */
export async function deleteDeliveryPhoto(fileId: string): Promise<void> {
  const base = required("API_GATEWAY_URL").replace(/\/$/, "");
  const response = await fetch(`${base}/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${required("API_GATEWAY_CALLER_KEY")}` },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Delivery photo deletion failed: ${response.status}`);
  }
}

export function createDeliveryPhotoRetentionStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>, removeFile = deleteDeliveryPhoto) {
  return {
    async removeDue(now: Date): Promise<{ removed: number; failed: number }> {
      const day = 24 * 60 * 60 * 1000;
      const eligible = and(
        isNotNull(orders.deliveryPhotoFileId), isNull(orders.deliveryPhotoRemovedAt),
        or(
          and(eq(orders.status, "received"), lte(orders.receivedAt, new Date(now.getTime() - 7 * day))),
          and(eq(orders.status, "delivered"), isNull(orders.receivedAt), lte(orders.deliveredAt, new Date(now.getTime() - 8 * day))),
        ),
        notExists(db.select({ id: orderReturns.id }).from(orderReturns).where(and(
          eq(orderReturns.orderId, orders.id), inArray(orderReturns.status, ["requested", "approved", "goods received"]),
        ))),
      );
      const candidates = await db.select({ id: orders.id }).from(orders).where(eligible).orderBy(orders.id);
      let removed = 0;
      let failed = 0;
      for (const candidate of candidates) {
        try {
          const didRemove = await db.transaction(async (tx) => {
            // Receipt and Return creation lock this same Order. Recheck after acquiring
            // the lock so overlapping jobs cannot delete twice or remove held evidence.
            await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, candidate.id)).for("update");
            const [order] = await tx.select({ fileId: orders.deliveryPhotoFileId }).from(orders)
              .where(and(eq(orders.id, candidate.id), eligible));
            if (!order?.fileId) return false;
            await removeFile(order.fileId);
            await tx.update(orders).set({ deliveryPhotoFileId: null, deliveryPhotoRemovedAt: now })
              .where(eq(orders.id, candidate.id));
            return true;
          });
          if (didRemove) removed += 1;
        } catch (error) {
          failed += 1;
          console.error(`Delivery photo for Order #${candidate.id} could not be removed`, error);
        }
      }
      return { removed, failed };
    },
  };
}

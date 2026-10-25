import { and, eq, isNotNull } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { required } from "../gateway";
import { orders } from "../db/schema";

/** Resolves a short-lived signed address for the Customer's own Delivery photo; null when there is none. */
export function createDeliveryPhotoReader<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>, send: typeof fetch = fetch) {
  return async function signedUrl(customerId: string, orderId: number): Promise<string | null> {
    const [order] = await db.select({ fileId: orders.deliveryPhotoFileId }).from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId), isNotNull(orders.deliveryPhotoFileId))).limit(1);
    if (!order?.fileId) return null;
    const base = required("API_GATEWAY_URL").replace(/\/$/, "");
    const response = await send(`${base}/files/${encodeURIComponent(order.fileId)}`, {
      headers: { Authorization: `Bearer ${required("API_GATEWAY_CALLER_KEY")}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error(`Delivery photo lookup failed: ${response.status}`);
    const file = await response.json();
    const url = new URL(file.url);
    if (file.id !== order.fileId || url.protocol !== "https:") throw new Error("Delivery photo lookup returned an unusable file.");
    return url.toString();
  };
}

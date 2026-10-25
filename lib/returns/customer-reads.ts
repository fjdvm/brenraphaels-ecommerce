import { desc, eq, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { orderReturnImages, orderReturnItems, orderReturns, orders } from "../db/schema";
import { formatReturnNumber } from "./returns";

/** A Customer's Return as shown to them: File ids only, never signed URLs. */
export type CustomerReturn = Awaited<ReturnType<typeof listCustomerReturns>>[number];

/** Every Return on the Customer's own Orders, newest first, whatever its status. */
export async function listCustomerReturns<TQueryResult extends PgQueryResultHKT, TSchema extends Record<string, unknown>>(
  db: PgDatabase<TQueryResult, TSchema>, customerId: string,
) {
  const rows = await db.select({ return: orderReturns }).from(orderReturns)
    .innerJoin(orders, eq(orderReturns.orderId, orders.id))
    .where(eq(orders.customerId, customerId))
    .orderBy(desc(orderReturns.requestedAt), desc(orderReturns.id));
  const ids = rows.map(({ return: row }) => row.id);
  if (ids.length === 0) return [];
  const [items, images] = await Promise.all([
    db.select().from(orderReturnItems).where(inArray(orderReturnItems.returnId, ids)).orderBy(orderReturnItems.orderLineId),
    db.select().from(orderReturnImages).where(inArray(orderReturnImages.returnId, ids)).orderBy(orderReturnImages.position),
  ]);
  return rows.map(({ return: row }) => ({
    id: row.id,
    number: formatReturnNumber(row.id),
    orderId: row.orderId,
    status: row.status,
    reason: row.reason,
    note: row.note,
    amountInCentavos: row.amountInCentavos,
    preferredResolution: row.preferredResolution,
    finalResolution: row.finalResolution,
    goodsRequired: row.goodsRequired,
    declineReason: row.declineReason,
    photoFileIds: images.filter((image) => image.returnId === row.id).map((image) => image.fileId),
    videoFileId: row.videoFileId,
    refundProofFileId: row.refundProofFileId,
    items: items.filter((item) => item.returnId === row.id).map(({ productName, sizeLabel, quantity, priceInCentavos }) =>
      ({ productName, sizeLabel, quantity, priceInCentavos })),
    requestedAt: row.requestedAt,
    refundedAt: row.refundedAt,
    replacedAt: row.replacedAt,
  }));
}

import { and, eq, inArray } from "drizzle-orm";
import { completedAtOf, isCompleted } from "../orders/completion";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { orderLines, orderReturnItems, orderReturns, orders } from "../db/schema";
import type { Order } from "../orders/orders";
import { formatReturnNumber } from "./returns";

export type ReturnOfferLine = {
  id: number;
  productName: string;
  sizeLabel: string;
  quantity: number;
  priceInCentavos: number;
  imageUrl: string | null;
  /** False once the line sits in an active, Refunded or Replaced Return. */
  returnable: boolean;
};

/** What the My orders card needs to offer, or track, a Return on one delivered Order. */
export type ReturnOffer = {
  deliveredAtMs: number | null;
  /** A Manager extended the window once by 24 hours. */
  windowExtended: boolean;
  /** How the Order was paid; a refund goes back the same way. */
  paymentMethod: string;
  lines: ReturnOfferLine[];
  requested: { id: number; number: string } | null;
};

const lockingStatuses = ["requested", "approved", "goods received", "refunded", "replaced"] as const;

/** Return data for the Customer's delivered Orders, keyed by Order id. */
export function createReturnOfferStore<TQueryResult extends PgQueryResultHKT, TSchema extends Record<string, unknown>>(
  db: PgDatabase<TQueryResult, TSchema>,
) {
  async function forCustomer(customerId: string, customerOrders: Order[]): Promise<Map<number, ReturnOffer>> {
    const delivered = customerOrders.filter((order) => isCompleted(order.status));
    const offers = new Map<number, ReturnOffer>();
    if (delivered.length === 0) return offers;
    const ids = delivered.map((order) => order.id);

    const [lines, deliveries, locked, requested] = await Promise.all([
      db.select().from(orderLines).where(inArray(orderLines.orderId, ids)).orderBy(orderLines.id),
      db.select({ id: orders.id, deliveredAt: orders.deliveredAt, collectedAt: orders.collectedAt, extendedAt: orders.refundWindowExtendedAt, paymentMethod: orders.paymentMethod }).from(orders)
        .where(and(eq(orders.customerId, customerId), inArray(orders.id, ids))),
      db.select({ orderLineId: orderReturnItems.orderLineId }).from(orderReturnItems)
        .innerJoin(orderReturns, eq(orderReturnItems.returnId, orderReturns.id))
        .where(and(inArray(orderReturns.orderId, ids), inArray(orderReturns.status, [...lockingStatuses]))),
      db.select({ id: orderReturns.id, orderId: orderReturns.orderId }).from(orderReturns)
        .where(and(inArray(orderReturns.orderId, ids), eq(orderReturns.status, "requested"))),
    ]);
    const lockedIds = new Set(locked.map((row) => row.orderLineId));
    const deliveredAt = new Map(deliveries.map((row) => [row.id, completedAtOf(row)?.getTime() ?? null]));
    const paidWith = new Map(deliveries.map((row) => [row.id, row.paymentMethod]));
    const extended = new Set(deliveries.filter((row) => row.extendedAt).map((row) => row.id));

    for (const order of delivered) {
      const images = new Map(order.lines.map((line) => [`${line.productName}|${line.sizeLabel}`, line.imageUrl]));
      const pending = requested.find((row) => row.orderId === order.id);
      offers.set(order.id, {
        deliveredAtMs: deliveredAt.get(order.id) ?? null,
        windowExtended: extended.has(order.id),
        paymentMethod: paidWith.get(order.id) ?? order.paymentMethod,
        lines: lines.filter((line) => line.orderId === order.id).map((line) => ({
          id: line.id, productName: line.productName, sizeLabel: line.sizeLabel, quantity: line.quantity,
          priceInCentavos: line.priceInCentavos, imageUrl: images.get(`${line.productName}|${line.sizeLabel}`) ?? null,
          returnable: !lockedIds.has(line.id),
        })),
        requested: pending ? { id: pending.id, number: formatReturnNumber(pending.id) } : null,
      });
    }
    return offers;
  }
  return { forCustomer };
}

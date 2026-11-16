import { and, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { orders, products } from "../db/schema";
import { parseProductDescription } from "../catalog/description";
import type { AssistantOrder } from "./facts";

/** Read-only access to a Customer's own Orders. Nothing here can write, and no method takes an Order id without the Customer's id. */
export type OrderReader = {
  listRecent(customerId: string, limit: number): Promise<AssistantOrder[]>;
  findOwn(customerId: string, orderId: number): Promise<AssistantOrder | undefined>;
};

export type ProductDetails = { name: string; sections: { heading: string; lines: string[] }[] };

/** Read-only access to a Product's listed details. */
export type ProductReader = { findMentioned(text: string): Promise<ProductDetails | undefined> };

type Db<R extends PgQueryResultHKT, S extends Record<string, unknown>> = PgDatabase<R, S>;

const columns = {
  id: orders.id,
  status: orders.status,
  fulfillmentMethod: orders.fulfillmentMethod,
  paymentMethod: orders.paymentMethod,
  createdAt: orders.createdAt,
  paidAt: orders.paidAt,
  deliveredAt: orders.deliveredAt,
  receivedAt: orders.receivedAt,
  extendedAt: orders.refundWindowExtendedAt,
  courier: orders.courier,
  courierTrackingUrl: orders.courierTrackingUrl,
  proofSubmittedAt: orders.paymentProofSubmittedAt,
  proofRejectedAt: orders.paymentProofRejectedAt,
  quoteRequired: orders.deliveryFeeQuoteRequired,
  fee: orders.deliveryFeeInCentavos,
};

function toAssistantOrder(row: {
  id: number; status: string; fulfillmentMethod: string; paymentMethod: string; createdAt: Date; paidAt: Date | null;
  deliveredAt: Date | null; receivedAt: Date | null; extendedAt: Date | null; courier: string | null; courierTrackingUrl: string | null;
  proofSubmittedAt: Date | null; proofRejectedAt: Date | null; quoteRequired: boolean; fee: number | null;
}): AssistantOrder {
  const live = row.status !== "cancelled" && row.status !== "delivered" && row.status !== "received";
  return {
    id: row.id,
    status: row.status,
    fulfillmentMethod: row.fulfillmentMethod === "pickup" ? "pickup" : "delivery",
    paymentMethod: row.paymentMethod,
    createdAt: row.createdAt,
    paidAt: row.paidAt,
    deliveredAt: row.deliveredAt,
    receivedAt: row.receivedAt,
    refundWindowExtended: row.extendedAt !== null,
    courierName: row.courier,
    courierTrackingUrl: row.courier ? row.courierTrackingUrl : null,
    proofSubmitted: row.proofSubmittedAt !== null,
    proofRejected: row.proofRejectedAt !== null,
    feePending: row.fulfillmentMethod === "delivery" && row.fee === null && live,
  };
}

export function createOrderReader<R extends PgQueryResultHKT, S extends Record<string, unknown>>(db: Db<R, S>): OrderReader {
  return {
    async listRecent(customerId, limit) {
      const rows = await db.select(columns).from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.createdAt), desc(orders.id)).limit(limit);
      return rows.map(toAssistantOrder);
    },
    async findOwn(customerId, orderId) {
      const [row] = await db.select(columns).from(orders).where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)));
      return row ? toAssistantOrder(row) : undefined;
    },
  };
}

export function createProductReader<R extends PgQueryResultHKT, S extends Record<string, unknown>>(db: Db<R, S>): ProductReader {
  return {
    async findMentioned(text) {
      const rows = await db.select({ name: products.name, description: products.description }).from(products);
      const lower = text.toLowerCase();
      const words = (name: string) => name.toLowerCase().split(/[^a-z0-9ñ]+/).filter((word) => word.length >= 3);
      const match = rows
        .filter((row) => lower.includes(row.name.toLowerCase()) || (words(row.name).length >= 2 && words(row.name).every((word) => lower.includes(word))))
        .sort((a, b) => b.name.length - a.name.length)[0];
      if (!match) return undefined;
      const parsed = parseProductDescription(match.description);
      return {
        name: match.name,
        sections: parsed.sections.map((section) => ({ heading: section.heading, lines: section.lines.map((line) => line.text) })),
      };
    },
  };
}

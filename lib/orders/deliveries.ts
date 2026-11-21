import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { orderLines, orders } from "../db/schema";

/** Statuses an Order with a courier booking passes through: on the way, then delivered, then received by the Customer. */
export const DELIVERY_STATUSES = ["dispatched", "delivered", "received"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** One of the Customer's Delivery Orders that has the courier's booking share link. Rider details are never part of it. */
export type Delivery = {
  id: number;
  status: DeliveryStatus;
  courier: "Lalamove" | "Grab";
  trackingUrl: string;
  deliveredAt: Date | null;
  /** "Ube Jam · 250g × 1  ·  …", as on the My orders card. */
  summary: string;
};

/** True once the rider has handed the Order over: the Customer goes to the Order instead of the map. */
export const isDelivered = (delivery: Pick<Delivery, "status">) => delivery.status !== "dispatched";

/** Where Go to order leads: the My orders card for this Order, opened. */
export const orderHref = (id: number) => `/profile/orders?order=${id}`;
export const trackHref = (id: number) => `/profile/delivery/${id}`;

/** The Customer's Orders shown in the Delivery tab: only their own, only with a share link, newest first. */
export function createDeliveryReader<TQueryResult extends PgQueryResultHKT, TSchema extends Record<string, unknown>>(db: PgDatabase<TQueryResult, TSchema>) {
  async function read(customerId: string, orderId?: number): Promise<Delivery[]> {
    const rows = await db
      .select({ id: orders.id, status: orders.status, courier: orders.courier, trackingUrl: orders.courierTrackingUrl, deliveredAt: orders.deliveredAt })
      .from(orders)
      .where(and(
        eq(orders.customerId, customerId),
        isNotNull(orders.courier),
        isNotNull(orders.courierTrackingUrl),
        inArray(orders.status, [...DELIVERY_STATUSES]),
        ...(orderId === undefined ? [] : [eq(orders.id, orderId)]),
      ))
      .orderBy(desc(orders.createdAt), desc(orders.id));
    if (rows.length === 0) return [];
    const lines = await db
      .select({ orderId: orderLines.orderId, productName: orderLines.productName, sizeLabel: orderLines.sizeLabel, quantity: orderLines.quantity })
      .from(orderLines)
      .where(inArray(orderLines.orderId, rows.map((row) => row.id)))
      .orderBy(asc(orderLines.id));
    return rows.map((row) => ({
      id: row.id,
      status: row.status as DeliveryStatus,
      courier: row.courier as Delivery["courier"],
      trackingUrl: row.trackingUrl as string,
      deliveredAt: row.deliveredAt,
      summary: lines.filter((line) => line.orderId === row.id).map((line) => `${line.productName} · ${line.sizeLabel} × ${line.quantity}`).join("  ·  "),
    }));
  }

  return {
    listForCustomer: (customerId: string) => read(customerId),
    /** Null unless the Order is the Customer's own and has a share link. */
    getForCustomer: async (customerId: string, orderId: number) => (await read(customerId, orderId))[0] ?? null,
  };
}

const EMBEDDABLE_HOSTS = ["lalamove.com", "grab.com"];

/**
 * Google's "Embed a map" link (Share → Embed a map, the iframe's src). It is the only Google Maps address that allows
 * framing; ordinary place and maps.app.goo.gl links refuse it, so they open in a new tab like any other link.
 */
const isGoogleMapsEmbed = (url: URL) => url.hostname.toLowerCase() === "www.google.com" && url.pathname === "/maps/embed";

/** Only the couriers' own https pages (and a Google Maps embed) are shown inside the shop; any other link opens in a new tab instead. */
export function embeddableTrackingUrl(link: string): string | null {
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (isGoogleMapsEmbed(url)) return url.toString();
    return EMBEDDABLE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)) ? url.toString() : null;
  } catch {
    return null;
  }
}

import { and, eq, like } from "drizzle-orm";
import { completedAtOf, isCompleted } from "./completion";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  customers, orderDeliveryAddresses, orderLines, orderReturnItems, orderReturns, orders, stockOutbox, stockReservations,
} from "../db/schema";
import { textField } from "../validators/fields";
import { staffAttribution } from "../validators/staff";
import type { AuditEvent } from "../audit/gateway";
import { required } from "../gateway";
import { createStockReservations } from "./stock-reservations";
import { gatewayShopStock, StockRefusedError, type ShopStock } from "./stock";

export class ReplacementError extends Error {}

export const replacementOrderInput = z.object({ ...staffAttribution.shape }).strict();
export const windowExtensionInput = z.object({
  reason: textField("Reason", { min: 1, max: 500, pattern: /^[^<>\p{Cc}]+$/u, patternMessage: "Enter plain text without markup or control characters", rejectInvisible: true }),
  ...staffAttribution.shape,
}).strict();

const day = 24 * 60 * 60 * 1000;

/**
 * Replacement Orders and the Refund window extension. CREOMS decides who may ask (a Manager approves); the storefront
 * keeps the Order, its Reservation and the Customer email. Both calls are safe to repeat.
 */
export function createReplacementOrders<T extends PgQueryResultHKT, S extends Record<string, unknown>>(
  db: PgDatabase<T, S>, stock: ShopStock = gatewayShopStock(),
) {
  /** A ₱0 Order linked to the original, with its own Reservation, no Delivery fee quote and one Customer email. */
  async function create(returnId: number, raw: unknown): Promise<{ returnId: number; replacementOrderId: number }> {
    const input = replacementOrderInput.parse(raw);
    const found = async () => (await db.select({ id: orders.id }).from(orders).where(eq(orders.replacementForReturnId, returnId)))[0];
    const already = await found();
    if (already) return { returnId, replacementOrderId: already.id };

    const [ret] = await db.select().from(orderReturns).where(eq(orderReturns.id, returnId));
    if (!ret) throw new ReplacementError("Return not found.");
    if (ret.finalResolution !== "replacement" || !["approved", "goods received"].includes(ret.status)) {
      throw new ReplacementError("This Return is not an approved replacement.");
    }
    const items = await db.select().from(orderReturnItems).where(eq(orderReturnItems.returnId, returnId)).orderBy(orderReturnItems.orderLineId);
    if (!items.length) throw new ReplacementError("This Return has no items to replace.");
    const [original] = await db.select().from(orders).where(eq(orders.id, ret.orderId));
    const [originalReservation] = await db.select().from(stockReservations).where(eq(stockReservations.orderId, ret.orderId));
    // The Size of each line lives only on the original Reservation.
    const lines = items.map(item => {
      const source = originalReservation?.lines.find(line => line.orderLineId === item.orderLineId);
      return source ? { item, source } : null;
    });
    if (lines.some(line => line === null)) throw new ReplacementError("This Order has no recorded stock, so a replacement cannot be reserved.");

    // One Reservation per attempt. A refused attempt is released and the next attempt starts fresh.
    const prefix = `replacement-${returnId}-`;
    const attempts = await db.select().from(stockReservations).where(like(stockReservations.id, `${prefix}%`)).orderBy(stockReservations.id);
    let reservation = attempts.at(-1);
    if (reservation && !["pending"].includes(reservation.state)) reservation = undefined;
    if (!reservation) {
      [reservation] = await db.insert(stockReservations).values({
        id: `${prefix}${attempts.length + 1}`, customerId: original.customerId, customerName: input.staffName, state: "pending",
        lines: lines.map(line => ({ lineId: `size-${line!.source.sizeId}`, productId: line!.source.productId, quantity: line!.item.quantity,
          sizeId: line!.source.sizeId, cartLineId: line!.source.cartLineId, priceInCentavos: 0 })),
      }).returning();
    }
    const reservations = createStockReservations(db, stock);
    try {
      for (const line of reservation.lines) {
        if (await stock.move("reserve", reservation.id, line) !== "reserved") throw new StockRefusedError();
      }
    } catch (error) {
      if (error instanceof StockRefusedError) {
        await reservations.abandon(reservation.id);
        await reservations.drain(new Date(), reservation.id).catch(() => undefined);
        throw new ReplacementError("The replacement is out of stock, so no Replacement Order was created.");
      }
      throw error;
    }

    const [customer] = await db.select({ email: customers.email }).from(customers).where(eq(customers.id, original.customerId));
    const [address] = await db.select().from(orderDeliveryAddresses).where(eq(orderDeliveryAddresses.orderId, original.id));
    const replacementOrderId = await db.transaction(async tx => {
      await tx.select({ id: orderReturns.id }).from(orderReturns).where(eq(orderReturns.id, returnId)).for("update");
      const [raced] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.replacementForReturnId, returnId));
      if (raced) return raced.id;
      // Paid in effect: it costs the Customer nothing, so it goes straight to packing. The shop pays the courier; no fee is quoted.
      const [order] = await tx.insert(orders).values({
        customerId: original.customerId, fulfillmentMethod: original.fulfillmentMethod, paymentMethod: original.paymentMethod,
        status: "paid", subtotalInCentavos: 0, deliveryFeeInCentavos: 0, deliveryFeeQuoteRequired: false,
        replacementForOrderId: original.id, replacementForReturnId: returnId,
      }).returning();
      const inserted = await tx.insert(orderLines).values(lines.map(line => ({
        orderId: order.id, productName: line!.item.productName, sizeLabel: line!.item.sizeLabel, priceInCentavos: 0, quantity: line!.item.quantity,
      }))).returning({ id: orderLines.id });
      if (address) await tx.insert(orderDeliveryAddresses).values({ ...address, orderId: order.id });
      await createStockReservations(tx, stock).commit(reservation.id, order.id, inserted.map(line => line.id));
      const audit: AuditEvent = {
        source: "Ecommerce", action: "order.replacement_created", outcome: "success",
        actor: { type: "staff", id: input.staffId, display_name: input.staffName },
        target: { type: "order", id: String(order.id), display_name: `Order #${order.id}` },
        description: `Replacement Order #${order.id} created for Return RMA-${returnId} (Order #${original.id}).`,
        occurred_at: new Date().toISOString(), idempotency_key: `order.replacement_created:${returnId}`,
      };
      await tx.insert(stockOutbox).values({ key: audit.idempotency_key!, kind: "audit", payload: audit }).onConflictDoNothing();
      // The key makes the email once, however many times CREOMS repeats the request. No orderId: this is not a stock-release email.
      await tx.insert(stockOutbox).values({ key: `order.replacement_created:${returnId}:email`, kind: "email", payload: {
        to: customer.email, title: `Your replacement for Return RMA-${returnId} is on its way`,
        body: `We're sending a replacement (Order #${order.id}) for your Return RMA-${returnId}. It costs you nothing, and we pay for delivery.`,
        button: { label: "View your Order", link: `${required("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "")}/profile/orders?order=${order.id}` },
      } }).onConflictDoNothing();
      return order.id;
    });
    return { returnId, replacementOrderId };
  }

  /** One extension per Order, by 24 hours, while the Order is delivered. Returns the new end of the window. */
  async function extendWindow(orderId: number, raw: unknown): Promise<{ orderId: number; endsAt: Date }> {
    const input = windowExtensionInput.parse(raw);
    return db.transaction(async tx => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (!order) throw new ReplacementError("Order not found.");
      if (order.refundWindowExtendedAt) throw new ReplacementError("The Refund window was already extended once.");
      const completed = completedAtOf(order);
      if (!isCompleted(order.status) || !completed) throw new ReplacementError("Only a delivered or picked up Order has a Refund window to extend.");
      await tx.update(orders).set({
        refundWindowExtendedAt: new Date(), refundWindowExtensionReason: input.reason,
        refundWindowExtendedById: input.staffId, refundWindowExtendedByName: input.staffName,
      }).where(and(eq(orders.id, orderId)));
      const audit: AuditEvent = {
        source: "Ecommerce", action: "order.refund_window_extended", outcome: "success",
        actor: { type: "staff", id: input.staffId, display_name: input.staffName },
        target: { type: "order", id: String(orderId), display_name: `Order #${orderId}` },
        description: `Refund window of Order #${orderId} extended by 24 hours: ${input.reason}`,
        occurred_at: new Date().toISOString(), idempotency_key: `order.refund_window_extended:${orderId}`,
      };
      await tx.insert(stockOutbox).values({ key: audit.idempotency_key!, kind: "audit", payload: audit }).onConflictDoNothing();
      return { orderId, endsAt: new Date(completed.getTime() + 2 * day) };
    });
  }
  return { create, extendWindow };
}

import { and, asc, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { orderLines, orders } from "../db/schema";
import { createCartStore } from "./cart";

export const fulfillmentMethods = ["pickup", "delivery"] as const;
export const paymentMethods = ["cash-on-delivery", "gcash"] as const;

export type FulfillmentMethod = (typeof fulfillmentMethods)[number];
export type PaymentMethod = (typeof paymentMethods)[number];
export const orderStatuses = [
  "placed",
  "confirmed",
  "awaiting payment",
  "paid",
  "preparing",
  "dispatched",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export type OrderLine = {
  productName: string;
  sizeLabel: string;
  priceInCentavos: number;
  quantity: number;
};

export type Order = {
  id: number;
  fulfillmentMethod: FulfillmentMethod;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  subtotalInCentavos: number;
  // Pickup Orders never have one; Delivery Orders get theirs once staff quote it.
  deliveryFeeInCentavos: number | null;
  createdAt: Date;
  lines: OrderLine[];
};

export type OrderStore = {
  place(
    customerId: string,
    input: { fulfillmentMethod: FulfillmentMethod; paymentMethod: PaymentMethod },
  ): Promise<Order>;
  listForCustomer(customerId: string): Promise<Order[]>;
  advance(
    orderId: number,
    input: { status: OrderStatus; deliveryFeeInCentavos?: number },
  ): Promise<Order>;
};

export type OrderMailer = {
  send(recipientEmail: string, order: Order): Promise<void>;
};

/**
 * Places the Order and then notifies the Customer. The Order is already
 * persisted and the Cart already emptied by the time the email is sent, so a
 * failed or slow confirmation email must not be reported as a failed checkout.
 */
export async function placeOrderAndNotify(
  customerId: string,
  recipientEmail: string,
  input: { fulfillmentMethod: FulfillmentMethod; paymentMethod: PaymentMethod },
  dependencies: { orderStore: OrderStore; mailer: OrderMailer },
): Promise<Order> {
  const order = await dependencies.orderStore.place(customerId, input);
  try {
    await dependencies.mailer.send(recipientEmail, order);
  } catch (error) {
    console.error("Order-placed email could not be sent", error);
  }
  return order;
}

export function createOrderStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): OrderStore {
  async function linesForOrder(orderId: number): Promise<OrderLine[]> {
    return db
      .select({
        productName: orderLines.productName,
        sizeLabel: orderLines.sizeLabel,
        priceInCentavos: orderLines.priceInCentavos,
        quantity: orderLines.quantity,
      })
      .from(orderLines)
      .where(eq(orderLines.orderId, orderId))
      .orderBy(asc(orderLines.id));
  }

  function toOrder(row: typeof orders.$inferSelect, lines: OrderLine[]): Order {
    return {
      id: row.id,
      fulfillmentMethod: row.fulfillmentMethod as FulfillmentMethod,
      paymentMethod: row.paymentMethod as PaymentMethod,
      status: row.status as OrderStatus,
      subtotalInCentavos: row.subtotalInCentavos,
      deliveryFeeInCentavos: row.deliveryFeeInCentavos,
      createdAt: row.createdAt,
      lines,
    };
  }

  async function listForCustomer(customerId: string): Promise<Order[]> {
    const persistedOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt), desc(orders.id));

    return Promise.all(
      persistedOrders.map(async (order) => toOrder(order, await linesForOrder(order.id))),
    );
  }

  async function advance(
    orderId: number,
    input: { status: OrderStatus; deliveryFeeInCentavos?: number },
  ): Promise<Order> {
    const [persistedOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));
    if (!persistedOrder) throw new Error("Order was not found.");

    const permittedNextStatuses: Record<OrderStatus, readonly OrderStatus[]> = {
      placed: ["confirmed", "cancelled"],
      confirmed: persistedOrder.paymentMethod === "gcash"
        ? ["awaiting payment", "cancelled"]
        : ["preparing", "cancelled"],
      "awaiting payment": ["paid", "cancelled"],
      paid: ["preparing", "cancelled"],
      preparing: ["dispatched", "cancelled"],
      dispatched: ["delivered"],
      delivered: [],
      cancelled: [],
    };
    const currentStatus = persistedOrder.status as OrderStatus;
    if (!permittedNextStatuses[currentStatus].includes(input.status)) {
      throw new Error(`\"${input.status}\" is not a legal transition from \"${currentStatus}\".`);
    }
    if (
      input.deliveryFeeInCentavos !== undefined
      && (input.status !== "confirmed" || persistedOrder.fulfillmentMethod !== "delivery")
    ) {
      throw new Error("A Delivery fee can only be set when confirming a Delivery Order.");
    }

    const [updatedOrder] = await db
      .update(orders)
      .set({
        status: input.status,
        ...(input.deliveryFeeInCentavos === undefined
          ? {}
          : { deliveryFeeInCentavos: input.deliveryFeeInCentavos }),
      })
      // Keep a concurrent update from overwriting a status that was just advanced.
      .where(and(eq(orders.id, orderId), eq(orders.status, currentStatus)))
      .returning();
    if (!updatedOrder) throw new Error("Order status changed before it could be advanced.");

    return toOrder(updatedOrder, await linesForOrder(updatedOrder.id));
  }

  async function place(
    customerId: string,
    input: { fulfillmentMethod: FulfillmentMethod; paymentMethod: PaymentMethod },
  ): Promise<Order> {
    return db.transaction(async (transaction) => {
      const transactionalCart = createCartStore(transaction);
      const cart = await transactionalCart.get(customerId);
      if (cart.lines.length === 0) {
        throw new Error("Your Cart is empty.");
      }
      if (cart.lines.some((line) => !line.available)) {
        throw new Error("This Size is unavailable.");
      }

      const [order] = await transaction
        .insert(orders)
        .values({
          customerId,
          fulfillmentMethod: input.fulfillmentMethod,
          paymentMethod: input.paymentMethod,
          // A human has to quote Delivery before it is confirmed; Pickup has no such step.
          status: input.fulfillmentMethod === "delivery" ? "placed" : "confirmed",
          subtotalInCentavos: cart.subtotalInCentavos,
          deliveryFeeInCentavos: null,
        })
        .returning();

      await transaction.insert(orderLines).values(cart.lines.map((line) => ({
        orderId: order.id,
        productName: line.productName,
        sizeLabel: line.sizeLabel,
        priceInCentavos: line.priceInCentavos,
        quantity: line.quantity,
      })));
      await transactionalCart.clear(customerId);

      // Built from the Cart lines already in hand, not re-queried: `linesForOrder`
      // is bound to the outer `db`, and querying it from inside this still-open
      // transaction (PGlite has a single underlying connection) would deadlock.
      return toOrder(order, cart.lines.map(({ productName, sizeLabel, priceInCentavos, quantity }) => ({
        productName,
        sizeLabel,
        priceInCentavos,
        quantity,
      })));
    });
  }

  return { place, listForCustomer, advance };
}

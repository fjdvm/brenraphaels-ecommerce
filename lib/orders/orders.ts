import { asc, desc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { cartLines, orderLines, orders } from "../db/schema";
import { createCartStore } from "./cart";

export const fulfillmentMethods = ["pickup"] as const;
export const paymentMethods = ["cash-on-delivery"] as const;

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
  deliveryFeeInCentavos: null;
  createdAt: Date;
  lines: OrderLine[];
};

export type OrderStore = {
  place(
    customerId: string,
    input: { fulfillmentMethod: FulfillmentMethod; paymentMethod: PaymentMethod },
  ): Promise<Order>;
  listForCustomer(customerId: string): Promise<Order[]>;
};

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

  async function listForCustomer(customerId: string): Promise<Order[]> {
    const persistedOrders = await db
      .select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt), desc(orders.id));

    return Promise.all(persistedOrders.map(async (order) => ({
      id: order.id,
      fulfillmentMethod: order.fulfillmentMethod as FulfillmentMethod,
      paymentMethod: order.paymentMethod as PaymentMethod,
      status: order.status as OrderStatus,
      subtotalInCentavos: order.subtotalInCentavos,
      deliveryFeeInCentavos: null,
      createdAt: order.createdAt,
      lines: await linesForOrder(order.id),
    })));
  }

  async function place(
    customerId: string,
    input: { fulfillmentMethod: FulfillmentMethod; paymentMethod: PaymentMethod },
  ): Promise<Order> {
    return db.transaction(async (transaction) => {
      const cart = await createCartStore(transaction).get(customerId);
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
          status: "confirmed",
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
      await transaction.delete(cartLines).where(eq(cartLines.customerId, customerId));

      return {
        id: order.id,
        fulfillmentMethod: input.fulfillmentMethod,
        paymentMethod: input.paymentMethod,
        status: "confirmed",
        subtotalInCentavos: order.subtotalInCentavos,
        deliveryFeeInCentavos: null,
        createdAt: order.createdAt,
        lines: cart.lines.map(({ productName, sizeLabel, priceInCentavos, quantity }) => ({
          productName,
          sizeLabel,
          priceInCentavos,
          quantity,
        })),
      };
    });
  }

  return { place, listForCustomer };
}

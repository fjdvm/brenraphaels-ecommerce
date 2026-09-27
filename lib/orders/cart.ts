import { and, asc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { cartLines, products, sizes } from "../db/schema";

/** A line is capped so one accidental tap cannot create an impractical Order. */
export const cartLineQuantityLimit = 10;

export type GuestCartLine = { sizeId: number; quantity: number };

export type CartLine = {
  id: number;
  sizeId: number;
  productSlug: string;
  productName: string;
  sizeLabel: string;
  priceInCentavos: number;
  quantity: number;
  available: boolean;
};

export type Cart = { lines: CartLine[]; subtotalInCentavos: number };

export type CartStore = {
  get(customerId: string): Promise<Cart>;
  addSize(customerId: string, sizeId: number, quantity: number): Promise<Cart>;
  updateLine(customerId: string, lineId: number, quantity: number): Promise<Cart>;
  removeLine(customerId: string, lineId: number): Promise<Cart>;
  mergeGuestCart(customerId: string, lines: GuestCartLine[]): Promise<Cart>;
};

function cappedQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Cart quantity must be a positive whole number.");
  }
  return Math.min(quantity, cartLineQuantityLimit);
}

export function createCartStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): CartStore {
  async function get(customerId: string): Promise<Cart> {
    const lines = await db
      .select({
        id: cartLines.id,
        sizeId: sizes.id,
        productSlug: products.slug,
        productName: products.name,
        sizeLabel: sizes.label,
        priceInCentavos: sizes.priceInCentavos,
        quantity: cartLines.quantity,
        available: sizes.available,
      })
      .from(cartLines)
      .innerJoin(sizes, eq(cartLines.sizeId, sizes.id))
      .innerJoin(products, eq(sizes.productSlug, products.slug))
      .where(eq(cartLines.customerId, customerId))
      .orderBy(asc(cartLines.id));

    return {
      lines,
      subtotalInCentavos: lines.reduce(
        (subtotal, line) => subtotal + line.priceInCentavos * line.quantity,
        0,
      ),
    };
  }

  async function addSize(customerId: string, sizeId: number, quantity: number): Promise<Cart> {
    const amount = cappedQuantity(quantity);
    const [size] = await db.select().from(sizes).where(eq(sizes.id, sizeId));
    if (!size || !size.available) {
      throw new Error("This Size is unavailable.");
    }

    const [existing] = await db
      .select()
      .from(cartLines)
      .where(and(eq(cartLines.customerId, customerId), eq(cartLines.sizeId, sizeId)));

    if (existing) {
      await db
        .update(cartLines)
        .set({ quantity: Math.min(existing.quantity + amount, cartLineQuantityLimit) })
        .where(eq(cartLines.id, existing.id));
    } else {
      await db.insert(cartLines).values({ customerId, sizeId, quantity: amount });
    }

    return get(customerId);
  }

  async function updateLine(customerId: string, lineId: number, quantity: number): Promise<Cart> {
    await db
      .update(cartLines)
      .set({ quantity: cappedQuantity(quantity) })
      .where(and(eq(cartLines.id, lineId), eq(cartLines.customerId, customerId)));
    return get(customerId);
  }

  async function removeLine(customerId: string, lineId: number): Promise<Cart> {
    await db
      .delete(cartLines)
      .where(and(eq(cartLines.id, lineId), eq(cartLines.customerId, customerId)));
    return get(customerId);
  }

  async function mergeGuestCart(customerId: string, lines: GuestCartLine[]): Promise<Cart> {
    for (const line of lines) {
      if (Number.isInteger(line.sizeId) && Number.isInteger(line.quantity) && line.quantity > 0) {
        await addSize(customerId, line.sizeId, line.quantity);
      }
    }
    return get(customerId);
  }

  return { get, addSize, updateLine, removeLine, mergeGuestCart };
}

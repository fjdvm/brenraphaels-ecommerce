import { and, asc, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { cartLines, cartMerges, productImages, products, sizes } from "../db/schema";
import { gatewayProductImages, productThumbnail, type ProductImageFiles, type ProductImageReference } from "../catalog/product-images";
import { readStockLeft } from "../catalog/stock-labels";
import { gatewayShopStock, type ShopStock } from "./stock";
import { cartLineQuantityLimit } from "./quantity";

export { cartLineQuantityLimit } from "./quantity";

export type VisitorCartLine = { sizeId: number; quantity: number };

export type CartLine = {
  id: number;
  sizeId: number;
  productSlug: string;
  productName: string;
  sizeLabel: string;
  /** The Product's first photo, when it has one. */
  imageUrl: string | null;
  priceInCentavos: number;
  quantity: number;
  available: boolean;
  /** Left to sell, from the IMS; null when it could not be read. */
  left: number | null;
  /** Why checkout refuses this line, in plain words. */
  blockedReason?: string;
};

export type Cart = { lines: CartLine[]; subtotalInCentavos: number };

export type CartStore = {
  get(customerId: string): Promise<Cart>;
  addSize(customerId: string, sizeId: number, quantity: number): Promise<Cart>;
  updateLine(customerId: string, lineId: number, quantity: number): Promise<Cart>;
  removeLine(customerId: string, lineId: number): Promise<Cart>;
  /** Empties the Cart, e.g. once its lines have been snapshotted onto a placed Order. */
  clear(customerId: string): Promise<void>;
  mergeVisitorCart(
    customerId: string,
    visitorCartId: string,
    lines: VisitorCartLine[],
  ): Promise<Cart>;
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
>(db: PgDatabase<TQueryResult, TSchema>, files: ProductImageFiles = gatewayProductImages(), stock: ShopStock = gatewayShopStock()): CartStore {
  async function get(customerId: string): Promise<Cart> {
    const lines = await db
      .select({
        id: cartLines.id,
        sizeId: sizes.id,
        productSlug: products.slug,
        productName: products.name,
        sizeLabel: sizes.label,
        image: sql<ProductImageReference | null>`(select json_build_object('productSlug', ${productImages.productSlug}, 'fileId', ${productImages.fileId}, 'url', ${productImages.url}) from ${productImages} where ${productImages.productSlug} = ${products.slug} order by ${productImages.position} asc limit 1)`,
        priceInCentavos: sizes.priceInCentavos,
        quantity: cartLines.quantity,
        available: sizes.available,
      })
      .from(cartLines)
      .innerJoin(sizes, eq(cartLines.sizeId, sizes.id))
      .innerJoin(products, eq(sizes.productSlug, products.slug))
      .where(eq(cartLines.customerId, customerId))
      .orderBy(asc(cartLines.id));

    const left = await readStockLeft(lines.map(({ sizeId }) => sizeId), stock);
    return {
      lines: await Promise.all(lines.map(async ({ image, ...line }) => {
        const remaining = left.get(line.sizeId) ?? null;
        const blockedReason = remaining === 0 ? "Sold out. Remove it to check out."
          : remaining !== null && line.quantity > remaining ? `Only ${remaining} left. Lower the quantity to check out.`
          : !line.available ? "This Size is currently unavailable." : undefined;
        return { ...line, available: blockedReason === undefined, left: remaining, blockedReason, imageUrl: await productThumbnail(image, files) };
      })),
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

  async function clear(customerId: string): Promise<void> {
    await db.delete(cartLines).where(eq(cartLines.customerId, customerId));
  }

  async function mergeVisitorCart(
    customerId: string,
    visitorCartId: string,
    lines: VisitorCartLine[],
  ): Promise<Cart> {
    if (!visitorCartId) {
      throw new Error("A Visitor Cart needs an identifier to merge.");
    }

    await db.transaction(async (transaction) => {
      const inserted = await transaction
        .insert(cartMerges)
        .values({ visitorCartId, customerId })
        .onConflictDoNothing()
        .returning({ customerId: cartMerges.customerId });

      if (inserted.length === 0) {
        const [existing] = await transaction
          .select({ customerId: cartMerges.customerId })
          .from(cartMerges)
          .where(eq(cartMerges.visitorCartId, visitorCartId));
        if (existing?.customerId !== customerId) {
          throw new Error("This Visitor Cart belongs to a different Customer.");
        }
        return;
      }

      const transactionalStore = createCartStore(transaction, files, stock);
      for (const line of lines) {
        if (Number.isInteger(line.sizeId) && Number.isInteger(line.quantity) && line.quantity > 0) {
          await transactionalStore.addSize(customerId, line.sizeId, line.quantity);
        }
      }
    });
    return get(customerId);
  }

  return { get, addSize, updateLine, removeLine, clear, mergeVisitorCart };
}

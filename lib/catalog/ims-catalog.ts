import { and, eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { imsPriceChanges, productImages, products, sizes } from "../db/schema";
import { required } from "../gateway";
import { fileIdField } from "../validators/file-id";

/** One Size as the IMS product feed lists it (fjdvm/epic-crms#668). */
export type ImsProduct = {
  productId: number;
  name: string;
  /** The IMS Variant; null for a blank Variant, which is one unlabelled default Size. */
  variant: string | null;
  image: string | null;
  /** Philippine pesos. */
  price: number;
  active: boolean;
  /** The description CREOMS published; absent in the IMS feed itself. */
  description?: string;
};

export type ImsCatalogFeed = { read(): Promise<ImsProduct[]> };

/** Reads the feed from the IMS when a Customer opens a page; never cached and never polled. */
export function gatewayImsCatalog(fetcher: typeof fetch = fetch): ImsCatalogFeed {
  return {
    async read() {
      const response = await fetcher(`${required("IMS_URL").replace(/\/$/, "")}/api/shop/products`, {
        cache: "no-store", headers: { Authorization: `Bearer ${required("IMS_SHOP_API_KEY")}` }, signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error(`The IMS refused the product feed: ${response.status}`);
      const { products: feed } = await response.json();
      if (!Array.isArray(feed)) throw new Error("The IMS product feed was malformed.");
      return feed;
    },
  };
}

/** What CREOMS set for one IMS product: the shop name, price and image live only in CREOMS (`crms.product_content`). */
export type CreomsContent = {
  productId: number; name: string | null; price: number | null; imageFileId: string | null; description: string;
  /** Staff took it off the shop in CREOMS ("Remove from store"); publishing again there puts it back. */
  removed: boolean;
};
export type CreomsContentReader = { read(): Promise<CreomsContent[]> };

/** Reads what CREOMS set, fresh each sync. A failure fails the sync, so the shop keeps what it has rather than guessing. */
export function databaseCreomsContent(reader: { execute: (query: ReturnType<typeof sql>) => PromiseLike<unknown> }): CreomsContentReader {
  return {
    async read() {
      const result = await reader.execute(sql`select ims_product_id, name, price, image_file_id, description, removed_at is not null as removed from crms.product_content`);
      const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as { ims_product_id: number; name: string | null; price: string | number | null; image_file_id: string | null; description: string | null; removed: boolean | null }[];
      return rows.map((row) => ({
        productId: Number(row.ims_product_id), name: row.name, price: row.price === null ? null : Number(row.price), imageFileId: row.image_file_id,
        description: row.description ?? "", removed: row.removed === true,
      }));
    },
  };
}

/**
 * The IMS feed as the shop sells it: CREOMS owns the shop name, price, image and description, the IMS owns the product, its Variant and
 * whether it is still sold. The IMS price and image are never used. A product CREOMS has not given a price and an image
 * gets price 0 and no image, so a new one stays off the shop and one already on sale keeps what it has. One CREOMS
 * removed from the store is treated as not active, so the shop stops selling it until CREOMS publishes it again.
 */
export function withCreomsContent(feed: ImsCatalogFeed, content: CreomsContentReader): ImsCatalogFeed {
  return {
    async read() {
      const [items, published] = await Promise.all([feed.read(), content.read()]);
      const byId = new Map(published.map((entry) => [entry.productId, entry]));
      return items.map((item) => {
        const set = byId.get(item.productId);
        const name = set?.name?.trim() || item.name;
        const description = set?.description?.trim();
        // Removed in CREOMS: sold no more, like a product the IMS deactivated. Open Orders still finish.
        const active = item.active && !set?.removed;
        return { ...item, active, name, price: set?.price ?? 0, image: set?.imageFileId ?? null, ...(description ? { description } : {}) };
      });
    },
  };
}

export const slugFor = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** A product goes live by itself once it has a name, an image the shop can show, and a price. */
export function isLive(product: ImsProduct): boolean {
  return product.name.trim() !== "" && Number.isFinite(product.price) && product.price > 0
    && product.image !== null && fileIdField.safeParse(product.image).success;
}

/** The old explicit Size-id to IMS product-id mapping, used once to match Sizes the shop already sold. */
function legacyMapping(): Map<number, number> {
  try {
    const parsed = JSON.parse(process.env.IMS_SIZE_PRODUCT_IDS ?? "{}") as Record<string, unknown>;
    return new Map(Object.entries(parsed).filter((entry): entry is [string, number] => Number.isInteger(entry[1])).map(([sizeId, productId]) => [Number(sizeId), productId]));
  } catch { return new Map(); }
}

export type PriceChange = { id: number; sizeId: number; productName: string; sizeLabel: string; oldPriceInCentavos: number; newPriceInCentavos: number };

export function createImsCatalog<T extends PgQueryResultHKT, S extends Record<string, unknown>>(
  db: PgDatabase<T, S>, feed: ImsCatalogFeed,
  /** True when the feed's prices and images come from CREOMS (`withCreomsContent`), where a Manager already decided them. */
  options: { pricesDecided?: boolean } = {},
) {
  async function apply(items: ImsProduct[]) {
    await db.transaction(async (tx) => {
      const existing = await tx.select().from(sizes);
      const legacy = legacyMapping();
      const byIms = new Map(existing.filter((size) => size.imsProductId !== null).map((size) => [size.imsProductId!, size]));
      const unlinked = existing.filter((size) => size.imsProductId === null);
      const seen = new Set<number>();
      const described = new Set<string>();

      for (const item of [...items].sort((a, b) => a.productId - b.productId)) {
        seen.add(item.productId);
        const centavos = Math.round(item.price * 100);
        const label = item.variant ?? "";
        const slug = slugFor(item.name);
        let size = byIms.get(item.productId);
        // A Size the shop already sold is matched once, by the explicit mapping or by its Product and label.
        let linkedNow = false;
        if (!size) {
          size = unlinked.find((candidate) => legacy.get(candidate.id) === item.productId)
            ?? unlinked.find((candidate) => candidate.productSlug === slug && candidate.label === label && !legacy.has(candidate.id));
          if (size) { unlinked.splice(unlinked.indexOf(size), 1); linkedNow = true; }
        }

        if (!size) {
          if (!item.active || !isLive(item)) continue;
          await tx.insert(products).values({ slug, name: item.name.trim(), description: item.description ?? "" }).onConflictDoNothing();
          const [image] = await tx.select({ id: productImages.id }).from(productImages).where(eq(productImages.productSlug, slug)).limit(1);
          if (!image) await tx.insert(productImages).values({ productSlug: slug, fileId: item.image, alt: item.name.trim(), position: 0 });
          const [created] = await tx.insert(sizes).values({ productSlug: slug, label, priceInCentavos: centavos, available: true, imsProductId: item.productId })
            .onConflictDoNothing().returning();
          if (created) byIms.set(item.productId, created);
          continue;
        }

        const [pending] = await tx.select().from(imsPriceChanges).where(and(eq(imsPriceChanges.sizeId, size.id), eq(imsPriceChanges.status, "pending")));
        // CREOMS's price is already a Manager's decision there, so it goes live at once; it never waits in the IMS price queue.
        const decided = options.pricesDecided;
        const changes: Partial<typeof sizes.$inferInsert> = {};
        if (linkedNow) changes.imsProductId = item.productId;
        if (size.discontinued === item.active) changes.discontinued = !item.active;
        if (size.label !== label && !existing.some((other) => other.id !== size.id && other.productSlug === size.productSlug && other.label === label)) changes.label = label;
        if (centavos > 0 && centavos !== size.priceInCentavos) {
          // A price change on a Size already on sale waits for the owner when it is found while matching or while one is already waiting.
          if (!decided && (linkedNow || pending)) {
            if (pending) await tx.update(imsPriceChanges).set({ newPriceInCentavos: centavos }).where(eq(imsPriceChanges.id, pending.id));
            else await tx.insert(imsPriceChanges).values({ sizeId: size.id, oldPriceInCentavos: size.priceInCentavos, newPriceInCentavos: centavos });
          } else {
            changes.priceInCentavos = centavos;
            if (decided && pending) await tx.delete(imsPriceChanges).where(eq(imsPriceChanges.id, pending.id));
          }
        } else if (pending) {
          await tx.delete(imsPriceChanges).where(eq(imsPriceChanges.id, pending.id));
        }
        if (Object.keys(changes).length > 0) await tx.update(sizes).set(changes).where(eq(sizes.id, size.id));
        // A new shop image from CREOMS replaces the product's first image.
        if (decided && item.image !== null && fileIdField.safeParse(item.image).success) {
          const [first] = await tx.select().from(productImages).where(eq(productImages.productSlug, size.productSlug)).orderBy(productImages.position).limit(1);
          if (!first) await tx.insert(productImages).values({ productSlug: size.productSlug, fileId: item.image, alt: item.name.trim(), position: 0 });
          else if (first.fileId !== item.image) await tx.update(productImages).set({ fileId: item.image }).where(eq(productImages.id, first.id));
        }
        // CREOMS's description is shown on the product. Several Sizes share one product page: the first Size (lowest IMS id)
        // with a description wins. An empty one keeps what the shop has.
        if (item.description && !described.has(size.productSlug)) {
          described.add(size.productSlug);
          await tx.update(products).set({ description: item.description })
            .where(and(eq(products.slug, size.productSlug), sql`${products.description} <> ${item.description}`));
        }
        if (item.name.trim() !== "" && item.active) await tx.update(products).set({ name: item.name.trim() }).where(and(eq(products.slug, size.productSlug), sql`${products.name} <> ${item.name.trim()}`));
      }

      // A Size the IMS no longer lists is discontinued too.
      const gone = existing.filter((size) => size.imsProductId !== null && !seen.has(size.imsProductId) && !size.discontinued).map((size) => size.id);
      if (gone.length > 0) await tx.update(sizes).set({ discontinued: true }).where(inArray(sizes.id, gone));
    });
  }

  return {
    /** Brings the shop's Sizes in line with the IMS. Best effort: the shop keeps what it has when the IMS cannot be reached. */
    async sync(): Promise<boolean> {
      try { await apply(await feed.read()); return true; } catch (error) { console.error("IMS catalog sync failed", error); return false; }
    },

    /** Prices the IMS wants to change on Sizes already on sale, for the owner to check before they go live. */
    async pendingPriceChanges(): Promise<PriceChange[]> {
      return db.select({
        id: imsPriceChanges.id, sizeId: imsPriceChanges.sizeId, productName: products.name, sizeLabel: sizes.label,
        oldPriceInCentavos: imsPriceChanges.oldPriceInCentavos, newPriceInCentavos: imsPriceChanges.newPriceInCentavos,
      }).from(imsPriceChanges).innerJoin(sizes, eq(sizes.id, imsPriceChanges.sizeId)).innerJoin(products, eq(products.slug, sizes.productSlug))
        .where(eq(imsPriceChanges.status, "pending")).orderBy(products.name, sizes.label);
    },

    /** The owner approves the listed prices; they go live now. Placed Orders keep the price they were placed at. */
    async approvePriceChanges(now = new Date()): Promise<number> {
      return db.transaction(async (tx) => {
        const pending = await tx.select().from(imsPriceChanges).where(eq(imsPriceChanges.status, "pending")).for("update");
        for (const change of pending) {
          await tx.update(sizes).set({ priceInCentavos: change.newPriceInCentavos }).where(eq(sizes.id, change.sizeId));
          await tx.update(imsPriceChanges).set({ status: "approved", decidedAt: now }).where(eq(imsPriceChanges.id, change.id));
        }
        return pending.length;
      });
    },
  };
}

let inFlight: Promise<boolean> | undefined;
/** Reads the IMS once for concurrent page opens, then lets go; there is no timer. */
export function syncOnce(catalog: { sync(): Promise<boolean> }): Promise<boolean> {
  inFlight ??= catalog.sync().finally(() => { inFlight = undefined; });
  return inFlight;
}

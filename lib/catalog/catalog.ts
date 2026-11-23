import { and, asc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { productImages, products, sizes } from "../db/schema";
import { readStockLeft } from "./stock-labels";
import { gatewayShopStock, type ShopStock } from "../orders/stock";
import { createImsCatalog, databaseCreomsContent, gatewayImsCatalog, syncOnce, withCreomsContent } from "./ims-catalog";
import { gatewayProductImages, resolveProductImage, type ProductImageFiles } from "./product-images";

export type CatalogProductSize = { id: number; label: string; priceInCentavos: number; available: boolean; /** Left to sell, from the IMS; null when it could not be read. */ left: number | null };

export type CatalogProduct = {
  slug: string;
  name: string;
  image: string;
  lowestPriceInCentavos: number;
  highestPriceInCentavos: number;
  sizes: CatalogProductSize[];
};

export type CatalogProductDetail = {
  slug: string;
  name: string;
  description: string;
  images: { url: string; alt: string }[];
  sizes: CatalogProductSize[];
};

export type CatalogStore = {
  listProducts(): Promise<CatalogProduct[]>;
  findProduct(slug: string): Promise<CatalogProductDetail | undefined>;
};

/**
 * The shop takes its products, Sizes and whether they are still sold from the IMS, and their name, price and image from
 * CREOMS; without the IMS settings (tests, local) it keeps what it has.
 */
export function imsCatalogSync(db: PgDatabase<any, any>) {
  return process.env.IMS_URL && process.env.IMS_SHOP_API_KEY
    ? createImsCatalog(db, withCreomsContent(gatewayImsCatalog(), databaseCreomsContent(db)), { pricesDecided: true })
    : undefined;
}

/** Catalog reads are available to every Visitor; purchase access belongs to Cart and Order. */
export function createCatalogStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>, files: ProductImageFiles = gatewayProductImages(), stock: ShopStock = gatewayShopStock(), sync: { sync(): Promise<boolean> } | undefined = imsCatalogSync(db)): CatalogStore {
  /** An image with no File id has nothing to show; next/image rejects an empty src. */
  async function resolvedImages(images: { productSlug: string; fileId: string | null; url: string | null; alt: string }[]) {
    const resolved = await Promise.all(images.map(async (image) => ({ url: await resolveProductImage(image, files), alt: image.alt })));
    return resolved.filter((image): image is { url: string; alt: string } => image.url !== null);
  }
  /** A Size with none left is sold out even if its flag says otherwise. */
  function withStock<T extends { id: number; available: boolean }>(size: T, left: Map<number, number | null>) {
    const remaining = left.get(size.id) ?? null;
    return { ...size, available: size.available && remaining !== 0, left: remaining };
  }
  /** Only the Sizes the shop can sell; an unread IMS count (null) hides nothing. */
  function inStock<T extends { id: number; available: boolean }>(productSizes: T[], left: Map<number, number | null>) {
    return productSizes.map((size) => withStock(size, left)).filter((size) => size.available);
  }
  return {
    async listProducts() {
      if (sync) await syncOnce(sync);
      const [allProducts, allImages, allSizes] = await Promise.all([
        db.select().from(products).orderBy(asc(products.name)),
        db.select().from(productImages).orderBy(asc(productImages.position)),
        db
          .select({
            id: sizes.id,
            productSlug: sizes.productSlug,
            label: sizes.label,
            priceInCentavos: sizes.priceInCentavos,
            available: sizes.available,
          })
          .from(sizes)
          .where(eq(sizes.discontinued, false))
          .orderBy(asc(sizes.priceInCentavos)),
      ]);

      const left = await readStockLeft(allSizes.map(({ id }) => id), stock);
      const listed = await Promise.all(allProducts.map(async (product) => {
        const image = allImages.find(({ productSlug }) => productSlug === product.slug);
        // Sold-out Sizes are not shown, and a Product with nothing left to sell leaves the shop.
        const productSizes = inStock(allSizes.filter(({ productSlug }) => productSlug === product.slug), left);
        const url = image && await resolveProductImage(image, files);
        if (!url || productSizes.length === 0) return undefined;

        const prices = productSizes.map(({ priceInCentavos }) => priceInCentavos);
        return {
          slug: product.slug,
          name: product.name,
          image: url,
          lowestPriceInCentavos: Math.min(...prices),
          highestPriceInCentavos: Math.max(...prices),
          sizes: productSizes.map(({ id, label, priceInCentavos, available, left }) => ({ id, label, priceInCentavos, available, left })),
        };
      }));
      return listed.filter((product) => product !== undefined);
    },

    async findProduct(slug) {
      if (sync) await syncOnce(sync);
      const [product] = await db.select().from(products).where(eq(products.slug, slug));
      if (!product) return undefined;

      const [images, productSizes] = await Promise.all([
        db
          .select({ productSlug: productImages.productSlug, fileId: productImages.fileId, url: productImages.url, alt: productImages.alt })
          .from(productImages)
          .where(eq(productImages.productSlug, slug))
          .orderBy(asc(productImages.position)),
        db
          .select({
            id: sizes.id,
            label: sizes.label,
            priceInCentavos: sizes.priceInCentavos,
            available: sizes.available,
          })
          .from(sizes)
          .where(and(eq(sizes.productSlug, slug), eq(sizes.discontinued, false)))
          .orderBy(asc(sizes.priceInCentavos)),
      ]);
      // A discontinued product has left the shop.
      if (productSizes.length === 0 && (await db.select({ id: sizes.id }).from(sizes).where(eq(sizes.productSlug, slug))).length > 0) return undefined;

      const left = await readStockLeft(productSizes.map(({ id }) => id), stock);
      // A sold-out Product is not found, like a discontinued one; a sold-out Size is not shown.
      const forSale = inStock(productSizes, left);
      if (forSale.length === 0) return undefined;
      return { ...product, images: await resolvedImages(images), sizes: forSale };
    },
  };
}

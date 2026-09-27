import { asc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { productImages, products, sizes } from "../db/schema";

export type CatalogProduct = {
  slug: string;
  name: string;
  image: string;
  lowestPriceInCentavos: number;
  highestPriceInCentavos: number;
};

export type CatalogProductDetail = {
  slug: string;
  name: string;
  description: string;
  images: { url: string; alt: string }[];
  sizes: { label: string; priceInCentavos: number; available: boolean }[];
};

export type CatalogStore = {
  listProducts(): Promise<CatalogProduct[]>;
  findProduct(slug: string): Promise<CatalogProductDetail | undefined>;
};

/** Catalog reads are available to every Visitor; purchase access belongs to Cart and Order. */
export function createCatalogStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>): CatalogStore {
  return {
    async listProducts() {
      const [allProducts, allImages, allSizes] = await Promise.all([
        db.select().from(products).orderBy(asc(products.name)),
        db.select().from(productImages).orderBy(asc(productImages.position)),
        db.select().from(sizes),
      ]);

      return allProducts.flatMap((product) => {
        const image = allImages.find(({ productSlug }) => productSlug === product.slug);
        const productSizes = allSizes.filter(({ productSlug }) => productSlug === product.slug);
        if (!image || productSizes.length === 0) return [];

        const prices = productSizes.map(({ priceInCentavos }) => priceInCentavos);
        return [{
          slug: product.slug,
          name: product.name,
          image: image.url,
          lowestPriceInCentavos: Math.min(...prices),
          highestPriceInCentavos: Math.max(...prices),
        }];
      });
    },

    async findProduct(slug) {
      const [product] = await db.select().from(products).where(eq(products.slug, slug));
      if (!product) return undefined;

      const [images, productSizes] = await Promise.all([
        db
          .select({ url: productImages.url, alt: productImages.alt })
          .from(productImages)
          .where(eq(productImages.productSlug, slug))
          .orderBy(asc(productImages.position)),
        db
          .select({
            label: sizes.label,
            priceInCentavos: sizes.priceInCentavos,
            available: sizes.available,
          })
          .from(sizes)
          .where(eq(sizes.productSlug, slug))
          .orderBy(asc(sizes.priceInCentavos)),
      ]);

      return { ...product, images, sizes: productSizes };
    },
  };
}

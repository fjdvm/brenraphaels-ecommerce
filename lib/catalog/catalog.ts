import { asc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { productImages, products, sizes } from "../db/schema";
import { gatewayProductImages, resolveProductImage, type ProductImageFiles } from "./product-images";

export type CatalogProductSize = { id: number; label: string; priceInCentavos: number; available: boolean };

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

/** Catalog reads are available to every Visitor; purchase access belongs to Cart and Order. */
export function createCatalogStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>, files: ProductImageFiles = gatewayProductImages()): CatalogStore {
  async function imageUrl(image: { productSlug: string; fileId: string | null; url: string | null }) {
    return await resolveProductImage(image, files) ?? "";
  }
  return {
    async listProducts() {
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
          .orderBy(asc(sizes.priceInCentavos)),
      ]);

      const listed = await Promise.all(allProducts.map(async (product) => {
        const image = allImages.find(({ productSlug }) => productSlug === product.slug);
        const productSizes = allSizes.filter(({ productSlug }) => productSlug === product.slug);
        if (!image || productSizes.length === 0) return undefined;

        const prices = productSizes.map(({ priceInCentavos }) => priceInCentavos);
        return {
          slug: product.slug,
          name: product.name,
          image: await imageUrl(image),
          lowestPriceInCentavos: Math.min(...prices),
          highestPriceInCentavos: Math.max(...prices),
          sizes: productSizes.map(({ id, label, priceInCentavos, available }) => ({ id, label, priceInCentavos, available })),
        };
      }));
      return listed.filter((product) => product !== undefined);
    },

    async findProduct(slug) {
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
          .where(eq(sizes.productSlug, slug))
          .orderBy(asc(sizes.priceInCentavos)),
      ]);

      return { ...product, images: await Promise.all(images.map(async (image) => ({ url: await imageUrl(image), alt: image.alt }))), sizes: productSizes };
    },
  };
}

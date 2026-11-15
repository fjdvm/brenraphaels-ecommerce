import type { MetadataRoute } from "next";

import { createCatalogStore } from "@/lib/catalog/catalog";
import { getDatabase } from "@/lib/db";
import { siteUrl } from "@/lib/site/site-url";

export const dynamic = "force-dynamic";

const pages = ["", "/products", "/about", "/journey", "/faq", "/contact", "/privacy"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const products = await createCatalogStore(getDatabase()).listProducts();
  return [
    ...pages.map((path) => ({ url: `${base}${path}` })),
    ...products.map(({ slug }) => ({ url: `${base}/products/${slug}` })),
  ];
}

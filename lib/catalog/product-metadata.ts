import type { Metadata } from "next";

import type { CatalogProductDetail } from "./catalog";
import { parseProductDescription } from "./description";
import { siteUrl } from "../site/site-url";

const MAX_DESCRIPTION = 160;

/** A Product's own title, description and Open Graph tags for search results and shared links. */
export function productMetadata(product: CatalogProductDetail): Metadata {
  const intro = parseProductDescription(product.description).summary.join(" ").replace(/\s+/g, " ").trim();
  const description = intro
    ? intro.length > MAX_DESCRIPTION ? `${intro.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…` : intro
    : `Buy ${product.name} from Bren Raphael's.`;
  const url = `${siteUrl()}/products/${product.slug}`;
  const images = product.images.slice(0, 1).map((image) => ({ url: image.url, alt: image.alt || product.name }));
  return {
    title: product.name,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title: product.name, description, images },
    twitter: { card: images.length > 0 ? "summary_large_image" : "summary", title: product.name, description },
  };
}

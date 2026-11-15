import type { CatalogProduct } from "./catalog";
import { formatPeso } from "./currency";
import { stockLabel, type StockLabel } from "./stock-label";

/** What the search overlay needs to show one result. */
export type SearchResult = {
  slug: string;
  name: string;
  image: string;
  meta: string;
  price: string;
  /** "Sold out", "Only N left", or null when there is nothing to say. */
  stock: StockLabel | null;
};

export const maxOverlayResults = 4;
export const maxRecentSearches = 5;

function priceText(lowest: number, highest: number) {
  return lowest === highest ? formatPeso(lowest) : `${formatPeso(lowest)} – ${formatPeso(highest)}`;
}

/** The overlay's view of a Product: sold out when no Size is available, else the tightest Size's "Only N left". */
export function toSearchResult(product: CatalogProduct): SearchResult {
  const soldOut = product.sizes.every((size) => !size.available);
  const tightest = product.sizes
    .filter((size) => size.available && stockLabel(size.left) !== null)
    .sort((a, b) => (a.left ?? 0) - (b.left ?? 0))[0];
  return {
    slug: product.slug,
    name: product.name,
    image: product.image,
    meta: product.sizes.map((size) => size.label).join(" · "),
    price: priceText(product.lowestPriceInCentavos, product.highestPriceInCentavos),
    stock: soldOut ? { kind: "sold-out", text: "Sold out" } : tightest ? stockLabel(tightest.left) : null,
  };
}

/** Every word typed must appear in the name; sold-out Products stay in the results. */
export function matchResults(results: SearchResult[], query: string): SearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return results.filter(({ name }) => terms.every((term) => name.toLowerCase().includes(term)));
}

/** Newest first, no repeats (case-insensitive), capped. */
export function addRecentSearch(recent: string[], query: string): string[] {
  const text = query.replace(/\s+/g, " ").trim();
  if (!text) return recent;
  return [text, ...recent.filter((item) => item.toLowerCase() !== text.toLowerCase())].slice(0, maxRecentSearches);
}


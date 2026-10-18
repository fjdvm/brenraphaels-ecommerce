import type { CatalogProduct } from "./catalog";

export const categories = [
  { value: "powder", label: "Ube Powder" },
  { value: "jam", label: "Ube Jam" },
  { value: "halaya", label: "Ube Halaya" },
] as const;

export const sortOptions = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
] as const;

export type Category = (typeof categories)[number]["value"];
export type Sort = (typeof sortOptions)[number]["value"];
export type BrowseParams = { category?: Category; sort?: Sort };

/**
 * The Catalog is imported from a feed that carries no category, but every
 * Product's name says what it is, so the category is read from the name.
 */
export function productCategory(name: string): Category | undefined {
  const lowered = name.toLowerCase();
  return categories.find(({ value }) => lowered.includes(value))?.value;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Reads the Shop's `?category=&sort=` params; anything unrecognised is ignored. */
export function parseBrowseParams(params: Record<string, string | string[] | undefined>): BrowseParams {
  const category = categories.find(({ value }) => value === first(params.category))?.value;
  const sort = sortOptions.find(({ value }) => value === first(params.sort))?.value;
  return {
    ...(category ? { category } : {}),
    ...(sort && sort !== "featured" ? { sort } : {}),
  };
}

/** Filters to a category and orders by price; "featured" keeps the Catalog's own order. */
export function browseProducts(products: CatalogProduct[], { category, sort }: BrowseParams): CatalogProduct[] {
  const shown = category ? products.filter(({ name }) => productCategory(name) === category) : [...products];
  if (sort === "price-asc") return shown.sort((a, b) => a.lowestPriceInCentavos - b.lowestPriceInCentavos);
  if (sort === "price-desc") return shown.sort((a, b) => b.lowestPriceInCentavos - a.lowestPriceInCentavos);
  return shown;
}

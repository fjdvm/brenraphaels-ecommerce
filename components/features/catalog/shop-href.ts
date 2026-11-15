import type { BrowseParams } from "@/lib/catalog/browse";

/** The Shop URL for a set of browse params; defaults (all, featured) leave the URL clean. */
export function shopHref(pathname: string, { category, sort, q }: BrowseParams) {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (category) query.set("category", category);
  if (sort && sort !== "featured") query.set("sort", sort);
  const text = query.toString();
  return text ? `${pathname}?${text}` : pathname;
}

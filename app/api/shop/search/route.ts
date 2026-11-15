import { createCatalogStore } from "@/lib/catalog/catalog";
import { toSearchResult } from "@/lib/catalog/search-results";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The Shop's Products in the overlay's shape; the overlay filters them as the Customer types. */
export async function GET() {
  try {
    const products = await createCatalogStore(getDatabase()).listProducts();
    return Response.json({ results: products.map(toSearchResult) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Search is unavailable right now" }, { status: 503 });
  }
}

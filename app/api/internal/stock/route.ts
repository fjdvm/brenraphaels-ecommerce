import { creomsStockCredential, verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { gatewayShopStock, readProductInventory, type SizeStock } from "@/lib/orders/stock";

export const runtime = "nodejs";

/**
 * What the IMS holds for each requested Size, for CREOMS's Products & stock page and Order detail.
 * Read on demand when Staff open a page; never cached and never polled. A Size the IMS cannot
 * answer for is null, so CREOMS can say so instead of guessing.
 */
export async function GET(request: Request) {
  if (!verifyCreomsCredential(request.headers, new Date(), creomsStockCredential)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const params = new URL(request.url).searchParams;
  const bad = (error: string) => Response.json({ error }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const parse = (name: string) => (params.get(name) ?? "").split(",").filter(Boolean).map(Number);
  const valid = (ids: number[]) => ids.length > 0 && ids.length <= 200 && ids.every((id) => Number.isSafeInteger(id) && id >= 1);
  const noStock = { quantity: null, reserved: null, available: null };
  const noCache = { "Cache-Control": "no-store" };

  // By IMS product id: the Stock page lists the IMS's own items, with what the shop can sell of each from the shop Warehouse.
  if (params.has("productIds")) {
    if (params.has("sizeIds")) return bad("Ask for Sizes or products, not both.");
    const ids = parse("productIds");
    if (!valid(ids)) return bad("Ask for between 1 and 200 product ids.");
    const wanted = [...new Set(ids)];
    // One read of the IMS figures (the same rule as checkout); if it fails, every product is unknown rather than guessed.
    const found = await readProductInventory(wanted).catch(() => new Map<number, SizeStock>());
    const products = wanted.map((productId) => ({ productId, ...(found.get(productId) ?? noStock) }));
    return Response.json({ products }, { headers: noCache });
  }

  const ids = parse("sizeIds");
  if (!valid(ids)) return bad("Ask for between 1 and 200 Size ids.");
  const stock = gatewayShopStock();
  const sizes = await Promise.all([...new Set(ids)].map(async (sizeId) => {
    try { return { sizeId, ...(await stock.read(sizeId)) }; } catch { return { sizeId, ...noStock }; }
  }));
  return Response.json({ sizes }, { headers: noCache });
}

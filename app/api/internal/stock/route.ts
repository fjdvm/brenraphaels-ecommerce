import { creomsStockCredential, verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { gatewayShopStock } from "@/lib/orders/stock";

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
  const raw = new URL(request.url).searchParams.get("sizeIds") ?? "";
  const ids = raw.split(",").filter(Boolean).map(Number);
  if (ids.length === 0 || ids.length > 200 || ids.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    return Response.json({ error: "Ask for between 1 and 200 Size ids." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const stock = gatewayShopStock();
  const sizes = await Promise.all([...new Set(ids)].map(async (sizeId) => {
    try { return { sizeId, ...(await stock.read(sizeId)) }; } catch { return { sizeId, quantity: null, reserved: null, available: null }; }
  }));
  return Response.json({ sizes }, { headers: { "Cache-Control": "no-store" } });
}

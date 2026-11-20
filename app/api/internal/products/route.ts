import { gatewayImsCatalog } from "@/lib/catalog/ims-catalog";
import { creomsStockCredential, verifyCreomsCredential } from "@/lib/orders/creoms-credential";

export const runtime = "nodejs";

/**
 * The IMS product feed, for CREOMS's Products & stock page. CREOMS holds no IMS key, so it asks here.
 * Read on demand when Staff open the page; never cached and never polled.
 */
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!verifyCreomsCredential(request.headers, new Date(), creomsStockCredential)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  try {
    return Response.json({ products: await gatewayImsCatalog().read() }, { headers });
  } catch (error) {
    console.error("The IMS product feed could not be read for CREOMS", error);
    return Response.json({ error: "The IMS product feed could not be read." }, { status: 502, headers });
  }
}

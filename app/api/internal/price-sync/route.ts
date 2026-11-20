import { createImsCatalog, gatewayImsCatalog } from "@/lib/catalog/ims-catalog";
import { creomsPriceSyncCredential, verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

function unauthorized(request: Request) {
  return verifyCreomsCredential(request.headers, new Date(), creomsPriceSyncCredential) ? null
    : Response.json({ error: "Unauthorized" }, { status: 401, headers });
}

/** The prices the IMS wants to change on Sizes already on sale, for the owner to check before they go live. */
export async function GET(request: Request) {
  const refused = unauthorized(request);
  if (refused) return refused;
  const catalog = createImsCatalog(getDatabase(), gatewayImsCatalog());
  await catalog.sync();
  return Response.json({ changes: await catalog.pendingPriceChanges() }, { headers });
}

/** The owner approves the listed prices; they go live now. */
export async function POST(request: Request) {
  const refused = unauthorized(request);
  if (refused) return refused;
  const approved = await createImsCatalog(getDatabase(), gatewayImsCatalog()).approvePriceChanges();
  return Response.json({ approved }, { headers });
}

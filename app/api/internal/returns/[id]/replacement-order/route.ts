import { after } from "next/server";
import { ZodError } from "zod";

import { getDatabase } from "@/lib/db";
import { creomsReturnCredential, verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { createReplacementOrders, ReplacementError } from "@/lib/orders/replacement-orders";
import { createStockReservations } from "@/lib/orders/stock-reservations";
import { StockUnavailableError } from "@/lib/orders/stock";
import { scheduleOrdersChanged } from "@/lib/orders/staff-signal";

export const runtime = "nodejs";

/** Creates the linked ₱0 Replacement Order for an approved replacement. Repeating returns the same Order. */
export async function POST(request: Request, context: RouteContext<"/api/internal/returns/[id]/replacement-order">) {
  if (!verifyCreomsCredential(request.headers, new Date(), creomsReturnCredential)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const returnId = Number(id);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(returnId)) return Response.json({ error: "Invalid Return id." }, { status: 400 });
  try {
    const result = await createReplacementOrders(getDatabase()).create(returnId, await request.json());
    scheduleOrdersChanged();
    after(async () => { await createStockReservations(getDatabase()).sendPending(); });
    return Response.json(result);
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: error.issues[0].message }, { status: 400 });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    if (error instanceof ReplacementError) return Response.json({ error: error.message }, { status: error.message === "Return not found." ? 404 : 409 });
    if (error instanceof StockUnavailableError) return Response.json({ error: error.message }, { status: 503 });
    return Response.json({ error: "The Replacement Order could not be confirmed. Refresh the Return before retrying." }, { status: 503 });
  }
}

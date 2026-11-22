import { after } from "next/server";
import { ZodError } from "zod";

import { getDatabase } from "@/lib/db";
import { creomsReturnCredential, verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { createStockReservations } from "@/lib/orders/stock-reservations";
import { StockUnavailableError } from "@/lib/orders/stock";
import { createReturnInspections, InspectionError } from "@/lib/returns/inspection";

export const runtime = "nodejs";

/** CREOMS records Staff's inspection of a Return (restocking sellable items) or a Manager-approved write-off. Repeating is safe. */
export async function POST(request: Request, context: RouteContext<"/api/internal/returns/[id]/inspection">) {
  if (!verifyCreomsCredential(request.headers, new Date(), creomsReturnCredential)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const returnId = Number(id);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(returnId)) return Response.json({ error: "Invalid Return id." }, { status: 400 });
  try {
    const result = await createReturnInspections(getDatabase()).handle(returnId, await request.json());
    after(async () => { await createStockReservations(getDatabase()).sendPending(); });
    return Response.json(result);
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: error.issues[0].message }, { status: 400 });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    if (error instanceof InspectionError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof StockUnavailableError) return Response.json({ error: error.message }, { status: 503 });
    return Response.json({ error: "The inspection could not be confirmed. Refresh the Return before retrying with the same inspection." }, { status: 503 });
  }
}
